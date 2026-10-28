import io, json, os, subprocess, tempfile, unittest, zipfile
from pathlib import Path
HELPER = Path(__file__).resolve().parents[1] / 'scripts' / 'moneypuck-game-rows.py'
class ArchiveTest(unittest.TestCase):
    def test_bounds_and_shape(self):
        header = 'playerId,season,gameId,gameDate,playerTeam,opposingTeam,home_or_away,icetime,I_F_shotsOnGoal,situation\n'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.zip'
            def run(name, content):
                with zipfile.ZipFile(path, 'w') as archive: archive.writestr(name, content)
                return subprocess.run(['python3', str(HELPER), str(path), '2025'], capture_output=True, text=True)
            valid = run('2025.csv', header + '8470001,2025,2025020001,20251001,NYR,BOS,HOME,1200,0,all\n')
            self.assertEqual(valid.returncode, 0)
            self.assertEqual(json.loads(valid.stdout)['rows'][0]['I_F_shotsOnGoal'], '0')
            for name, content in [('../2025.csv', header), ('2024.csv', header), ('2025.csv', 'other\n1\n'), ('2025.csv', header + 'short\n')]:
                self.assertNotEqual(run(name, content).returncode, 0)
if __name__ == '__main__': unittest.main()
