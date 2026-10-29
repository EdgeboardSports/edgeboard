"""Bounded MoneyPuck game-by-game skater feature reader; no ZIP extraction.
Retains only all and 5on4 situations. A player's 5on4 TOI is never used for
the same game's forecast, only for subsequent dates.
"""
import csv, hashlib, io, json, os, sys, zipfile
path, season = sys.argv[1:]
if len(season)!=4 or not season.isdigit() or os.path.getsize(path)>64*1024*1024:
    raise ValueError('Invalid season/archive')
fields=['playerId','season','gameId','gameDate','playerTeam','opposingTeam','home_or_away','icetime','I_F_shotsOnGoal','situation']
rows=[]
with zipfile.ZipFile(path) as archive:
    files=archive.infolist()
    allowed={season+'.csv', 'my stuff/var/www/html/moneypuck/summaryData/seasonPlayersSummary/skaters/'+season+'.csv'}
    if len(files)!=1 or files[0].filename not in allowed or files[0].file_size>256*1024*1024 or files[0].flag_bits&1:
        raise ValueError('Invalid archive structure: '+repr([(x.filename,x.file_size,x.flag_bits) for x in files[:8]]))
    with io.TextIOWrapper(archive.open(files[0]),encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        if not reader.fieldnames or len(set(reader.fieldnames))!=len(reader.fieldnames) or not set(fields).issubset(reader.fieldnames):
            raise ValueError('Missing required columns')
        for count,row in enumerate(reader,1):
            if count>500000 or None in row or any(x is None for x in row.values()):
                raise ValueError('Invalid CSV row')
            if row['season']!=season:
                raise ValueError('Season mismatch')
            if row['situation'] in ('all','5on4'):
                rows.append({field:row[field] for field in fields})
with open(path,'rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
print(json.dumps({'rows':rows,'sha256':digest},separators=(',',':')))
