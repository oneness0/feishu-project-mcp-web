/** GitLab 分支列表项（API v4 常见结构） */
export interface GitLabBranch {
  name: string;
}

/**
 * 从 feature/* 分支名解析需求单号。
 * 默认规则：分支名 feature/<需求单号>，取 / 后一段（如 feature/6995496915 → 6995496915）。
 */
export function parseRequirementNosFromBranches(
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

/** 拼装带 private_token 的 GitLab 分支查询 URL（token 仅由服务端从环境变量注入）。 */
export function buildGitlabBranchesUrl(baseUrl: string, privateToken: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("private_token", privateToken);
  return url.toString();
}
