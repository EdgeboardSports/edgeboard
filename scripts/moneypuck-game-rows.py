"""Read the explicitly listed MoneyPuck skater ZIP; never extract archive paths."""
import csv, hashlib, io, json, os, sys, zipfile
path, season, *options = sys.argv[1:]
if options not in ([], ['points']):
    raise ValueError('Unsupported game statistic')
if not season.isdigit() or len(season) != 4 or os.path.getsize(path) > 64 * 1024 * 1024:
    raise ValueError('Invalid season or archive size')
fields = ['playerId', 'season', 'gameId', 'gameDate', 'playerTeam', 'opposingTeam', 'home_or_away', 'icetime', 'I_F_shotsOnGoal']
if options == ['points']:
    fields += ['I_F_points', 'I_F_goals', 'I_F_primaryAssists', 'I_F_secondaryAssists']
rows, count, other = [], 0, 0
with zipfile.ZipFile(path) as archive:
    files = archive.infolist()
    if len(files) != 1 or files[0].filename != season + '.csv' or files[0].file_size > 256 * 1024 * 1024 or files[0].flag_bits & 1:
        raise ValueError('Expected one bounded season CSV')
    with io.TextIOWrapper(archive.open(files[0]), encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames) or not set(fields + ['situation']).issubset(reader.fieldnames):
            raise ValueError('Required game schema missing')
        for row in reader:
            count += 1
            if count > 500000 or None in row or any(v is None for v in row.values()):
                raise ValueError('Game CSV row limit or width mismatch')
            if row['season'] != season:
                raise ValueError('Wrong season')
            if row['situation'] != 'all':
                other += 1
                continue
            rows.append({field: row[field] for field in fields})
with open(path, 'rb') as stream:
    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
print(json.dumps(dict(rows=rows, sourceRows=count, otherSituations=other, sha256=digest), separators=(',', ':')))
