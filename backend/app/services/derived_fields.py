"""
app/services/derived_fields.py

Compute derived fields on the recognition DataFrame.
Called once at data load time. Results are cached on the DataFrame.
"""
import re
import pandas as pd

ACTION_VERBS = [
    'delivered','built','led','automated','reduced','increased','designed',
    'implemented','launched','created','resolved','developed','achieved',
    'completed','managed','optimized','improved','streamlined','negotiated',
    'spearheaded','coordinated','facilitated','transformed','pioneered',
    'executed','established','integrated','migrated','analyzed','architected'
]
CLICHE_PATTERNS = [
    r'goes? above and beyond', r'team player', r'rock star',
    r'knocked? it out of the park', r'hit the ground running',
    r'goes? the extra mile', r'think outside the box'
]


def extract_seniority(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['vp','vice president','chief','ceo','cto','cfo']): return 'Executive'
    if 'senior director' in t: return 'Sr Director'
    if 'director' in t: return 'Director'
    if 'senior manager' in t: return 'Sr Manager'
    if 'team leader' in t or 'team lead' in t: return 'Team Lead'
    if 'manager' in t and 'associate' not in t: return 'Manager'
    if any(x in t for x in ['principal','staff']): return 'Principal/Staff'
    if any(x in t for x in ['senior ','sr.','sr ']): return 'Senior IC'
    if any(x in t for x in ['junior','jr.','intern','associate']): return 'Entry'
    return 'IC'


def infer_function(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['engineer','software','developer','qa','sre','devops','infrastructure','cloud','helpdesk','it ']): return 'Engineering'
    if any(x in t for x in ['customer service','customer success','support']): return 'Customer Service'
    if any(x in t for x in ['product manager','product design','ux','ui','designer']): return 'Product & Design'
    if any(x in t for x in ['finance','accounting','payroll','buyer','procurement','accounts payable']): return 'Finance & Ops'
    if any(x in t for x in ['marketing','brand','content','copywriter','creative','media','demand gen']): return 'Marketing'
    if any(x in t for x in ['data','analyst','analytics','insight']): return 'Data & Analytics'
    if any(x in t for x in ['people','hr ','human','talent','recruiting']): return 'People & HR'
    if any(x in t for x in ['sales','business development','account exec','revenue']): return 'Sales'
    if any(x in t for x in ['legal','compliance','risk','security']): return 'Legal & Compliance'
    return 'Other'


def compute_specificity(msg: str) -> float:
    words = str(msg).lower().split()
    s = 0.0
    if re.search(r'\d+', str(msg).lower()): s += 0.3
    av = sum(1 for v in ACTION_VERBS if v in str(msg).lower())
    s += min(av, 2) * 0.15
    if len(words) > 40: s += 0.1
    if len(words) > 80: s += 0.1
    trait_ct = sum(1 for t in ['amazing','great','awesome','wonderful','fantastic','incredible','outstanding','excellent'] if t in str(msg).lower())
    if trait_ct > 0 and av == 0: s -= 0.15
    return round(min(max(s, 0), 1.0), 3)


def get_direction(nom_level: str, rec_level: str) -> str:
    mgr_levels = {'Executive','Sr Director','Director','Sr Manager','Manager','Team Lead'}
    ic_levels = {'Principal/Staff','Senior IC','IC','Entry'}
    if nom_level in mgr_levels and rec_level in ic_levels: return 'Downward'
    if nom_level in ic_levels and rec_level in mgr_levels: return 'Upward'
    return 'Lateral'


def classify_award(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['thank','thanks','appreciation']): return 'Thank You'
    if any(x in t for x in ['2025','2024','annual','year']): return 'Periodic'
    if any(x in t for x in ['launch','release','deliver','ship']): return 'Launch'
    if any(x in t for x in ['support','help','cover']): return 'Support'
    if any(x in t for x in ['team','collaborat']): return 'Teamwork'
    if any(x in t for x in ['customer','client','nps']): return 'Customer'
    if any(x in t for x in ['leader','mentor']): return 'Leadership'
    return 'Other'


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Add all derived fields to the recognition DataFrame."""
    df = df.copy()
    df['rec_seniority'] = df['recipient_title'].apply(extract_seniority)
    df['nom_seniority'] = df['nominator_title'].apply(extract_seniority)
    df['rec_function'] = df['recipient_title'].apply(infer_function)
    df['nom_function'] = df['nominator_title'].apply(infer_function)
    df['direction'] = df.apply(lambda r: get_direction(r['nom_seniority'], r['rec_seniority']), axis=1)
    df['specificity'] = df['message'].apply(compute_specificity)
    df['word_count'] = df['message'].str.split().str.len()
    df['action_verb_count'] = df['message'].apply(lambda m: sum(1 for v in ACTION_VERBS if v in str(m).lower()))
    df['has_numbers'] = df['message'].str.contains(r'\d+', regex=True).astype(int)
    df['cliche_count'] = df['message'].apply(lambda m: sum(1 for p in CLICHE_PATTERNS if re.search(p, str(m).lower())))
    df['award_type'] = df['award_title'].apply(classify_award)
    return df
