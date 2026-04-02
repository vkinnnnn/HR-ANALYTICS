"""
Recognition Data Loader — Loads annotated_results.csv, computes all derived fields,
optionally joins with workforce data. Caches enriched DataFrame in memory.
"""
import os, re
import pandas as pd
import numpy as np

_recog_cache: dict = {}

ACTION_VERBS = [
    'delivered','built','led','automated','reduced','increased','designed','implemented',
    'launched','created','resolved','developed','achieved','completed','managed','optimized',
    'improved','streamlined','negotiated','spearheaded','coordinated','facilitated',
    'transformed','pioneered','executed','established','integrated','migrated','analyzed','architected'
]

CLICHE_PATTERNS = [
    r'goes? above and beyond', r'team player', r'rock star', r'second to none',
    r'knocked? it out of the park', r'hit the ground running', r'think outside the box',
    r'goes? the extra mile'
]

SENIORITY_ORDER = ['Entry','IC','Senior IC','Principal/Staff','Team Lead','Assoc Manager',
                   'Manager','Sr Manager','Director','Sr Director','Executive']


def extract_seniority(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['vp','vice president','chief','ceo','cto','cfo','coo','cro']): return 'Executive'
    if 'senior director' in t or 'sr. director' in t: return 'Sr Director'
    if 'director' in t: return 'Director'
    if 'senior manager' in t or 'sr. manager' in t: return 'Sr Manager'
    if 'associate manager' in t: return 'Assoc Manager'
    if 'team leader' in t or 'team lead' in t: return 'Team Lead'
    if 'manager' in t: return 'Manager'
    if any(x in t for x in ['principal','staff']): return 'Principal/Staff'
    if any(x in t for x in ['senior','sr.','sr ']): return 'Senior IC'
    if any(x in t for x in ['junior','jr.','intern','associate','entry']): return 'Entry'
    return 'IC'


def infer_function(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['engineer','software','developer','devops','qa','sre','infrastructure','cloud','technical','helpdesk','it ']): return 'Engineering & Technology'
    if any(x in t for x in ['customer service','customer success','support specialist']): return 'Customer Service'
    if any(x in t for x in ['product manager','product design','ux','ui','designer']): return 'Product & Design'
    if any(x in t for x in ['finance','accounting','accounts payable','payroll','buyer','procurement','supply chain']): return 'Finance & Operations'
    if any(x in t for x in ['marketing','brand','content','copywriter','creative','media','demand gen','communications']): return 'Marketing & Brand'
    if any(x in t for x in ['data','analyst','analytics','insight','intelligence']): return 'Data & Analytics'
    if any(x in t for x in ['people','hr ','human','talent','recruiting','onboarding']): return 'People & HR'
    if any(x in t for x in ['sales','business development','account exec','revenue']): return 'Sales'
    if any(x in t for x in ['legal','compliance','risk','security','privacy']): return 'Legal & Compliance'
    if any(x in t for x in ['linguist','whiq','operations']): return 'Operations'
    return 'Other'


def compute_specificity(msg: str) -> float:
    words = str(msg).lower().split()
    score = 0.0
    if re.search(r'\d+', str(msg).lower()): score += 0.3
    av_count = sum(1 for v in ACTION_VERBS if v in str(msg).lower())
    score += min(av_count, 2) * 0.15
    if len(words) > 40: score += 0.1
    if len(words) > 80: score += 0.1
    trait_count = sum(1 for t in ['amazing','great','awesome','wonderful','fantastic','incredible','outstanding','excellent'] if t in str(msg).lower())
    if trait_count > 0 and av_count == 0: score -= 0.15
    return min(max(score, 0), 1.0)


def classify_award_type(title: str) -> str:
    t = str(title).lower()
    if any(x in t for x in ['thank','thanks','appreciation']): return 'Thank You'
    if any(x in t for x in ['2025','2024','year','annual','q1','q2','q3','q4']): return 'Periodic/Annual'
    if any(x in t for x in ['launch','release','ship','deploy','deliver']): return 'Launch/Delivery'
    if any(x in t for x in ['support','help','assist','cover']): return 'Support/Help'
    if any(x in t for x in ['innovat','creative','idea']): return 'Innovation'
    if any(x in t for x in ['team','collaborat','together']): return 'Teamwork'
    if any(x in t for x in ['customer','client','nps']): return 'Customer Focus'
    if any(x in t for x in ['leader','mentor','coach']): return 'Leadership'
    if any(x in t for x in ['birthday','anniversary','milestone','wedding','baby']): return 'Life Event'
    if any(x in t for x in ['above and beyond','outstanding','exceptional']): return 'Above & Beyond'
    return 'Other'


def _compute_direction(row) -> str:
    mgr_levels = {'Executive','Sr Director','Director','Sr Manager','Manager','Assoc Manager','Team Lead'}
    ic_levels = {'IC','Senior IC','Entry','Principal/Staff'}
    ns, rs = row['nominator_seniority'], row['recipient_seniority']
    if ns in mgr_levels and rs in ic_levels: return 'Downward'
    if ns in ic_levels and rs in mgr_levels: return 'Upward'
    ni = SENIORITY_ORDER.index(ns) if ns in SENIORITY_ORDER else 5
    ri = SENIORITY_ORDER.index(rs) if rs in SENIORITY_ORDER else 5
    if ni > ri + 1: return 'Downward'
    if ri > ni + 1: return 'Upward'
    return 'Lateral'


def load_recognition(data_dir: str | None = None) -> pd.DataFrame:
    """Load annotated_results.csv and compute all derived fields."""
    global _recog_cache
    data_dir = data_dir or os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"))

    path = os.path.join(data_dir, "annotated_results.csv")
    if not os.path.exists(path):
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8-sig')

    # Derived fields
    df['recipient_seniority'] = df['recipient_title'].apply(extract_seniority)
    df['nominator_seniority'] = df['nominator_title'].apply(extract_seniority)
    df['recipient_function'] = df['recipient_title'].apply(infer_function)
    df['nominator_function'] = df['nominator_title'].apply(infer_function)
    df['direction'] = df.apply(_compute_direction, axis=1)
    df['same_function'] = df['recipient_function'] == df['nominator_function']
    df['specificity'] = df['message'].apply(compute_specificity)
    df['award_type'] = df['award_title'].apply(classify_award_type)
    df['word_count'] = df['message'].apply(lambda m: len(str(m).split()))
    df['action_verb_count'] = df['message'].apply(lambda m: sum(1 for v in ACTION_VERBS if v in str(m).lower()))
    df['has_numbers'] = df['message'].apply(lambda m: bool(re.search(r'\d+', str(m))))
    df['cliche_count'] = df['message'].apply(lambda m: sum(1 for p in CLICHE_PATTERNS if re.search(p, str(m).lower())))

    # Specificity band
    df['specificity_band'] = pd.cut(df['specificity'], bins=[-0.01, 0.1, 0.25, 0.4, 0.6, 1.01],
                                     labels=['Very Vague','Vague','Moderate','Specific','Highly Specific'])

    # Optional join with workforce data
    wf_path = os.path.join(data_dir, "function_wh.csv")
    if os.path.exists(wf_path):
        try:
            wf = pd.read_csv(wf_path, index_col=0)
            wf_lookup = wf[['job_title','department_name','grade_title','function_title','country']].drop_duplicates(subset='job_title')
            df = df.merge(wf_lookup, left_on='recipient_title', right_on='job_title', how='left', suffixes=('','_wf'))
        except Exception:
            pass

    _recog_cache['recognition'] = df
    _recog_cache['loaded'] = True
    return df


def get_recognition() -> pd.DataFrame:
    if 'recognition' not in _recog_cache:
        load_recognition()
    return _recog_cache.get('recognition', pd.DataFrame())


def is_recognition_loaded() -> bool:
    return _recog_cache.get('loaded', False)


def compute_gini(values: list) -> float:
    """Compute Gini coefficient for a list of counts."""
    arr = np.array(sorted(values), dtype=float)
    n = len(arr)
    if n == 0 or arr.sum() == 0: return 0
    idx = np.arange(1, n + 1)
    return float((2 * np.sum(idx * arr) - (n + 1) * np.sum(arr)) / (n * np.sum(arr)))
