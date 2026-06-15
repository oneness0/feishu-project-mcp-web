/**
 * 返回 GitLab 实例的基础地址（优先取 GITLAB_BASE_URL，兜底从 GITLAB_BRANCHES_URL 提取），不含 token。
 * 供前端自动填充地址栏，浏览器再直接请求 GitLab。
 */
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.gitlabBaseUrl;
  const branchesUrl = config.gitlabBranchesUrl;

  let origin = "";
  if (baseUrl) {
    origin = baseUrl;
  } else if (branchesUrl) {
    origin = new URL(branchesUrl).origin;
  }

  if (origin) {
    return {
      origin,
      projectId: config.public.gitlabProjectId || "",
    };
  }

  setResponseStatus(useEvent(), 500);
  return { error: "服务端未配置 GITLAB_BASE_URL 或 GITLAB_BRANCHES_URL" };
});
