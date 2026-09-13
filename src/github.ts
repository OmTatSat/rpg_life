import { AppState } from './store';

const GH_API_BASE = 'https://api.github.com';

function toBase64Unicode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64Unicode(base64: string): string {
  return decodeURIComponent(escape(atob(base64)));
}

function parseRepo(repo: string): { owner: string; repoName: string } {
  const parts = repo.split('/');
  if (parts.length !== 2) throw new Error('Репозиторий должен быть в формате owner/repo');
  return { owner: parts[0], repoName: parts[1] };
}

export async function fetchFromGitHub(state: AppState): Promise<AppState | null> {
  if (!state.gh_token || !state.gh_repo) return null;

  const { owner, repoName } = parseRepo(state.gh_repo);
  const url = `${GH_API_BASE}/repos/${owner}/${repoName}/contents/${state.gh_file_path}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${state.gh_token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (res.status === 404) return null; // File doesn't exist yet
  if (!res.ok) throw new Error(`GitHub error: ${res.status}`);

  const data = await res.json();
  const content = fromBase64Unicode(data.content.replace(/\n/g, ''));
  return JSON.parse(content);
}

export async function saveToGitHub(state: AppState): Promise<void> {
  if (!state.gh_token || !state.gh_repo) throw new Error('GitHub не настроен');

  const { owner, repoName } = parseRepo(state.gh_repo);
  const url = `${GH_API_BASE}/repos/${owner}/${repoName}/contents/${state.gh_file_path}`;

  // Get current SHA if file exists
  let sha: string | undefined;
  try {
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `token ${state.gh_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }
  } catch (e) {
    // File doesn't exist, that's ok
  }

  // Prepare data without sensitive fields
  const dataToSave = { ...state };
  delete (dataToSave as any).gh_token;

  const content = toBase64Unicode(JSON.stringify(dataToSave, null, 2));

  const body: any = {
    message: `Update Life RPG data - ${new Date().toISOString()}`,
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${state.gh_token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`GitHub save error: ${errData.message || res.status}`);
  }
}

export function mergeState(local: AppState, remote: AppState): AppState {
  // Merge by ID to avoid duplicates
  const mergeById = <T extends { id: string }>(localArr: T[], remoteArr: T[]): T[] => {
    const map = new Map<string, T>();
    localArr.forEach(item => map.set(item.id, item));
    remoteArr.forEach(item => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        // If both have same ID, keep the one with more recent data
        const existing = map.get(item.id)!;
        if ('timestamp' in item && 'timestamp' in existing) {
          const itemTime = new Date((item as any).timestamp).getTime();
          const existingTime = new Date((existing as any).timestamp).getTime();
          if (itemTime > existingTime) {
            map.set(item.id, item);
          }
        }
      }
    });
    return Array.from(map.values());
  };

  // For goals, merge steps by ID
  const mergeGoals = (localGoals: AppState['goals'], remoteGoals: AppState['goals']): AppState['goals'] => {
    const goalMap = new Map<string, AppState['goals'][0]>();
    localGoals.forEach(g => goalMap.set(g.id, g));
    
    remoteGoals.forEach(remoteGoal => {
      if (!goalMap.has(remoteGoal.id)) {
        goalMap.set(remoteGoal.id, remoteGoal);
      } else {
        const localGoal = goalMap.get(remoteGoal.id)!;
        // Merge steps
        const stepMap = new Map<string, AppState['goals'][0]['steps'][0]>();
        localGoal.steps.forEach(s => stepMap.set(s.id, s));
        remoteGoal.steps.forEach(s => {
          if (!stepMap.has(s.id)) {
            stepMap.set(s.id, s);
          } else {
            // If marked done in either, keep it done
            const existing = stepMap.get(s.id)!;
            if (s.status === 'done' || existing.status === 'done') {
              stepMap.set(s.id, { ...s, status: 'done' });
            }
          }
        });
        goalMap.set(remoteGoal.id, {
          ...remoteGoal,
          steps: Array.from(stepMap.values()),
          status: Array.from(stepMap.values()).every(s => s.status === 'done') ? 'done' : remoteGoal.status,
        });
      }
    });
    
    return Array.from(goalMap.values());
  };

  return {
    ...local,
    history: mergeById(local.history, remote.history),
    goals: mergeGoals(local.goals, remote.goals),
    supplements_log: mergeById(local.supplements_log, remote.supplements_log),
    seeds: mergeById(local.seeds, remote.seeds),
    artifacts: mergeById(local.artifacts, remote.artifacts),
    insights: mergeById(local.insights || [], remote.insights || []),
    daily_quests: mergeById(local.daily_quests, remote.daily_quests),
    // For gold, take the max
    gold: Math.max(local.gold || 0, remote.gold || 0),
    // Keep local settings
    apiKey: local.apiKey,
    modelName: local.modelName,
    gh_token: local.gh_token,
    gh_repo: local.gh_repo,
    gh_file_path: local.gh_file_path,
  };
}
