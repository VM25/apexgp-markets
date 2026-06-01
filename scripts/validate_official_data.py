import os
import json
import sys

TARGET_DRIVERS_POINTS = {
    "NOR": 423,
    "VER": 421,
    "PIA": 410,
    "RUS": 319,
    "LEC": 242,
    "HAM": 156,
    "ANT": 150,
    "SAI": 135,
    "ALO": 90,
    "STR": 45,
    "LAW": 30,
    "TSU": 25,
    "OCO": 22,
    "GAS": 18,
    "HUL": 15,
    "ALB": 12,
    "BEA": 8,
    "DOO": 2,
    "BOR": 0,
    "HAD": 0
}

TARGET_CONSTRUCTORS_POINTS = {
    "MCL": 833,
    "MER": 469,
    "RBR": 451,
    "FER": 398,
    "WIL": 147,
    "AST": 135,
    "HAAS": 30,
    "VCARB": 25,
    "ALP": 20,
    "KICK": 15
}

OFFICIAL_WINNERS = [
    "NOR", "PIA", "VER", "PIA", "PIA", "PIA", "VER", "NOR", "PIA", "RUS",
    "NOR", "NOR", "PIA", "NOR", "PIA", "VER", "VER", "RUS", "VER", "NOR",
    "NOR", "VER", "VER", "VER"
]

def main():
    print("--------------------------------------------------")
    print("APEXGP 2025 HISTORICAL DATASETS INTEGRITY VALIDATOR")
    print("--------------------------------------------------")
    
    # 1. Load season metadata
    season_path = "public/data/official/season_2025.json"
    if not os.path.exists(season_path):
        print("[-] ERROR: public/data/official/season_2025.json is missing.")
        sys.exit(1)
        
    with open(season_path, "r") as f:
        season_data = json.load(f)
        
    if season_data.get("season") != 2025:
        print(f"[-] ERROR: Season year is not 2025. Found: {season_data.get('season')}")
        sys.exit(1)
        
    races = season_data.get("races", [])
    if len(races) != 24:
        print(f"[-] ERROR: Total rounds is not 24. Found: {len(races)}")
        sys.exit(1)
    print("[+] Total Rounds verified: 24")

    # 2. Check drivers and constructors standing in metadata
    metadata_drivers = {s["code"]: s["points"] for s in season_data.get("driver_standings", [])}
    for code, target_pts in TARGET_DRIVERS_POINTS.items():
        if metadata_drivers.get(code) != target_pts:
            print(f"[-] ERROR: Standings metadata mismatch for {code}. Expected {target_pts}, found {metadata_drivers.get(code)}")
            sys.exit(1)
    print("[+] Season Drivers Standings metadata points verified.")

    # 3. Check individual race logs
    accumulated_drivers = {code: 0 for code in TARGET_DRIVERS_POINTS.keys()}
    accumulated_constructors = {team: 0 for team in TARGET_CONSTRUCTORS_POINTS.keys()}
    
    DRIVER_TO_TEAM = {
        "VER": "RBR", "LAW": "RBR", "HAM": "FER", "LEC": "FER", "NOR": "MCL",
        "PIA": "MCL", "RUS": "MER", "ANT": "MER", "ALO": "AST", "STR": "AST",
        "GAS": "ALP", "DOO": "ALP", "OCO": "HAAS", "BEA": "HAAS", "ALB": "WIL",
        "SAI": "WIL", "TSU": "VCARB", "HAD": "VCARB", "HUL": "KICK", "BOR": "KICK"
    }

    for idx, r in enumerate(races):
        round_num = idx + 1
        race_id = r["id"]
        filename = f"round_{str(round_num).zfill(2)}_{race_id}.json"
        filepath = f"public/data/official/{filename}"
        
        if not os.path.exists(filepath):
            print(f"[-] ERROR: Race file missing: {filepath}")
            sys.exit(1)
            
        with open(filepath, "r") as f:
            race_data = json.load(f)
            
        if race_data.get("round_number") != round_num:
            print(f"[-] ERROR: Round number mismatch in {filename}. Expected {round_num}, found {race_data.get('round_number')}")
            sys.exit(1)
            
        final_results = race_data.get("final_result", [])
        if len(final_results) != 20:
            print(f"[-] ERROR: Drivers count is not 20 in {filename}. Found {len(final_results)}")
            sys.exit(1)
            
        # Check winner matches official record
        winner = final_results[0]
        expected_winner = OFFICIAL_WINNERS[idx]
        if winner["driver_code"] != expected_winner:
            print(f"[-] ERROR: Round {round_num} winner mismatch. Expected {expected_winner}, found {winner['driver_code']}")
            sys.exit(1)
            
        # Tally round points
        for res in final_results:
            code = res["driver_code"]
            pts = res["points"]
            accumulated_drivers[code] += pts
            
            team = DRIVER_TO_TEAM[code]
            accumulated_constructors[team] += pts
            
        print(f"[+] Round {str(round_num).zfill(2)} ({race_id}) verified. Winner: {winner['driver_code']}")

    # 4. Verify accumulated points against official targets
    print("\n--------------------------------------------------")
    print("ACCUMULATED STANDINGS INTEGRITY CHECKS")
    print("--------------------------------------------------")
    
    # Drivers Champion check
    sorted_drivers = sorted(accumulated_drivers.items(), key=lambda x: x[1], reverse=True)
    drivers_champion = sorted_drivers[0][0]
    
    if drivers_champion != "NOR":
        print(f"[-] ERROR: Drivers champion is NOT Lando Norris (NOR). Found: {drivers_champion}")
        sys.exit(1)
    if sorted_drivers[0][1] != 423:
        print(f"[-] ERROR: Norris final points are NOT 423. Found: {sorted_drivers[0][1]}")
        sys.exit(1)
    print(f"[+] Drivers Champion verified: Lando Norris (NOR) - 423 points")
    
    # Runner up check
    if sorted_drivers[1][0] != "VER" or sorted_drivers[1][1] != 421:
        print(f"[-] ERROR: Runner-up is NOT Max Verstappen (VER) with 421 points. Found: {sorted_drivers[1][0]} ({sorted_drivers[1][1]} pts)")
        sys.exit(1)
    print(f"[+] Runner-up verified: Max Verstappen (VER) - 421 points")
    
    # 3rd place check
    if sorted_drivers[2][0] != "PIA" or sorted_drivers[2][1] != 410:
        print(f"[-] ERROR: Third place is NOT Oscar Piastri (PIA) with 410 points. Found: {sorted_drivers[2][0]} ({sorted_drivers[2][1]} pts)")
        sys.exit(1)
    print(f"[+] Third-place verified: Oscar Piastri (PIA) - 410 points")

    # Complete Driver Standings Verification
    for code, target_pts in TARGET_DRIVERS_POINTS.items():
        accumulated = accumulated_drivers[code]
        if accumulated != target_pts:
            print(f"[-] ERROR: Drivers final accumulated points mismatch for {code}. Expected {target_pts}, found {accumulated}")
            sys.exit(1)
    print("[+] All 20 driver final points match official targets exactly.")

    # Constructors standings verification
    sorted_teams = sorted(accumulated_constructors.items(), key=lambda x: x[1], reverse=True)
    teams_champion = sorted_teams[0][0]
    if teams_champion != "MCL":
        print(f"[-] ERROR: Constructors champion is NOT McLaren (MCL). Found: {teams_champion}")
        sys.exit(1)
    if sorted_teams[0][1] != 833:
        print(f"[-] ERROR: McLaren final points are NOT 833. Found: {sorted_teams[0][1]}")
        sys.exit(1)
    print(f"[+] Constructors Champion verified: McLaren (MCL) - 833 points")

    for team, target_pts in TARGET_CONSTRUCTORS_POINTS.items():
        accumulated = accumulated_constructors[team]
        if accumulated != target_pts:
            print(f"[-] ERROR: Constructors final points mismatch for {team}. Expected {target_pts}, found {accumulated}")
            sys.exit(1)
    print("[+] All 10 team final points match official targets exactly.")

    print("\n[+] SUCCESS: ALL HISTORICAL DATASETS VERIFIED! 100% CORRECT.")
    sys.exit(0)

if __name__ == "__main__":
    main()
