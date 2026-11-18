"""Team names, franchise continuity and conference membership by season.

Season keys here are the ENDING year (2011 = 2010-11), as in nhl_results.
Conference sources (checked Nov 2026):
  - 2013 realignment: Detroit and Columbus to the East, Winnipeg to the West (NHL.com, NESN).
  - Vegas joins the Pacific/West in 2017-18 (NHL.com).
  - 2020-21: four temporary divisions, top 4 per division qualify (NHL.com).
  - Seattle joins the Pacific/West in 2021-22; Arizona moves to the Central (ESPN, NHL.com).
  - Utah takes over Arizona's hockey assets in the Central/West from 2024-25.
"""

FULL_TO_ABBR = {
    "Anaheim Ducks": "ANA", "Arizona Coyotes": "ARI", "Atlanta Thrashers": "ATL", "Boston Bruins": "BOS",
    "Buffalo Sabres": "BUF", "Calgary Flames": "CGY", "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI",
    "Colorado Avalanche": "COL", "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL", "Detroit Red Wings": "DET",
    "Edmonton Oilers": "EDM", "Florida Panthers": "FLA", "Los Angeles Kings": "LAK", "Minnesota Wild": "MIN",
    "Montreal Canadiens": "MTL", "Nashville Predators": "NSH", "New Jersey Devils": "NJD",
    "New York Islanders": "NYI", "New York Rangers": "NYR", "Ottawa Senators": "OTT",
    "Philadelphia Flyers": "PHI", "Phoenix Coyotes": "PHX", "Pittsburgh Penguins": "PIT",
    "San Jose Sharks": "SJS", "Seattle Kraken": "SEA", "St. Louis Blues": "STL", "Tampa Bay Lightning": "TBL",
    "Toronto Maple Leafs": "TOR", "Utah Hockey Club": "UTA", "Utah Mammoth": "UTA", "Vancouver Canucks": "VAN",
    "Vegas Golden Knights": "VGK", "Washington Capitals": "WSH", "Winnipeg Jets": "WPG",
}

# One franchise, one row (handout: Atlanta -> Winnipeg, Phoenix/Arizona -> Utah).
FRANCHISE = {"ATL": "WPG", "PHX": "UTA", "ARI": "UTA"}

FRANCHISE_NAME = {
    "ANA": "Anaheim Ducks", "BOS": "Boston Bruins", "BUF": "Buffalo Sabres", "CGY": "Calgary Flames",
    "CAR": "Carolina Hurricanes", "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche",
    "CBJ": "Columbus Blue Jackets", "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers", "LAK": "Los Angeles Kings", "MIN": "Minnesota Wild", "MTL": "Montreal Canadiens",
    "NSH": "Nashville Predators", "NJD": "New Jersey Devils", "NYI": "New York Islanders",
    "NYR": "New York Rangers", "OTT": "Ottawa Senators", "PHI": "Philadelphia Flyers",
    "PIT": "Pittsburgh Penguins", "SJS": "San Jose Sharks", "SEA": "Seattle Kraken", "STL": "St. Louis Blues",
    "TBL": "Tampa Bay Lightning", "TOR": "Toronto Maple Leafs", "UTA": "Utah (incl. Phoenix/Arizona)",
    "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights", "WSH": "Washington Capitals",
    "WPG": "Winnipeg (incl. Atlanta)",
}

_EAST_PRE13 = ["BOS", "BUF", "MTL", "OTT", "TOR", "NJD", "NYI", "NYR", "PHI", "PIT", "CAR", "FLA", "TBL", "WSH"]
_WEST_PRE13 = ["ANA", "CGY", "CHI", "CBJ", "COL", "DAL", "DET", "EDM", "LAK", "MIN", "NSH", "PHX", "SJS",
               "STL", "VAN"]
_EAST_POST13 = ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR", "CAR", "CBJ", "NJD", "NYI", "NYR",
                "PHI", "PIT", "WSH"]
_WEST_POST13 = ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "WPG", "ANA", "CGY", "EDM", "LAK", "SJS", "VAN"]
_DIV_2021 = {
    "North": ["CGY", "EDM", "MTL", "OTT", "TOR", "VAN", "WPG"],
    "West": ["ANA", "ARI", "COL", "LAK", "MIN", "SJS", "STL", "VGK"],
    "Central": ["CAR", "CHI", "CBJ", "DAL", "DET", "FLA", "NSH", "TBL"],
    "East": ["BOS", "BUF", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
}


def playoff_groups(season):
    """{team abbreviation: group} for the season, and playoff spots per group."""
    g = {}
    if season <= 2013:
        for t in _EAST_PRE13 + (["ATL"] if season == 2011 else ["WPG"]):
            g[t] = "East"
        for t in _WEST_PRE13:
            g[t] = "West"
        return g, 8
    if season == 2021:
        for div, teams in _DIV_2021.items():
            for t in teams:
                g[t] = div
        return g, 4
    for t in _EAST_POST13:
        g[t] = "East"
    west = list(_WEST_POST13) + (["PHX"] if season <= 2014 else ["ARI"] if season <= 2024 else ["UTA"])
    if season >= 2018:
        west.append("VGK")
    if season >= 2022:
        west.append("SEA")
    for t in west:
        g[t] = "West"
    return g, 8


def franchise(abbr):
    return FRANCHISE.get(abbr, abbr)
