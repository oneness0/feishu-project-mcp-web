/**
 * GitLab 代理：服务端用环境变量中的 GITLAB_PRIVATE_TOKEN 请求内网 GitLab。
 * 用法：/api/gitlab/proxy?path=/api/v4/user
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.gitlabBaseUrl;
  const branchesUrl = config.gitlabBranchesUrl;
  const privateToken = config.gitlabPrivateToken;

  const origin = baseUrl || (branchesUrl ? new URL(branchesUrl).origin : null);

  if (!origin || !privateToken) {
    setResponseStatus(event, 500);
    return {
      error: "服务端未配置 GITLAB_BASE_URL (或 GITLAB_BRANCHES_URL) 或 GITLAB_PRIVATE_TOKEN",
    };
  }

  const query = getQuery(event);
  const gitlabPath = (query.path as string) || "/api/v4/user";

  const targetUrl = new URL(gitlabPath, origin);
  targetUrl.searchParams.set("private_token", privateToken);

  const res = await fetch(targetUrl.toString(), {
    headers: { accept: "application/json" },
  });

  setResponseStatus(event, res.status);
  setResponseHeader(event, "content-type", "application/json");
  return res.json();
});
