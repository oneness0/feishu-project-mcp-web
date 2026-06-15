/** 浏览器侧：从内网 GitLab 拉 feature 分支并解析工作项单号 */

export interface GitLabBranch {
  name: string;
}

export function parseWorkItemIdsFromBranches(
  branches: GitLabBranch[],
  prefix = "feature/",
): string[] {
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const set = new Set<string>();
  for (const b of branches) {
    const name = b?.name?.trim();
    if (!name) continue;
    if (name.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
      const rawNo = name.slice(normalizedPrefix.length).trim();
      const match = rawNo.match(/^\d+/);
      const no = match ? match[0] : rawNo;
      if (no) set.add(no);
    }
  }
  return [...set];
}

export async function fetchGitlabFeatureBranches(
  branchesUrl: string,
): Promise<GitLabBranch[]> {
  const res = await fetch(branchesUrl);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GitLab 分支列表请求失败（HTTP ${res.status}）：${text.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("GitLab 返回格式异常，期望为分支数组");
  }
  return json as GitLabBranch[];
}
