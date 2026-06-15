import { buildGitlabBranchesUrl } from "../../utils/gitlab";
import { getMcpSession, getSessionTokenFromEvent } from "../../utils/sessionStore";

/**
 * 返回供浏览器直连内网 GitLab 的分支列表 URL（含 private_token，token 来自服务端环境变量）。
 * 须在用户浏览器发起请求（内网），服务端不代请求 GitLab。
 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  if (!sessionToken || !(await getMcpSession(sessionToken))) {
    setResponseStatus(event, 401);
    return { error: "未连接，请先完成飞书项目授权" };
  }

  const config = useRuntimeConfig();
  const baseUrl = config.public.gitlabBaseUrl;
  const projectId = config.public.gitlabProjectId;
  const branchesUrl = config.gitlabBranchesUrl;
  const token = config.gitlabPrivateToken;

  let targetUrl = "";
  if (baseUrl && projectId) {
    const origin = baseUrl.replace(/\/$/, "");
    // encodeURIComponent 确保斜杠被转义，或者直接信任 env 中的写法（通常带 %2F）
    const safeProjectId = projectId.includes("%2F") ? projectId : encodeURIComponent(projectId);
    const searchPrefix = config.gitlabBranchPrefix ? `^${config.gitlabBranchPrefix}` : "^feature/";
    targetUrl = `${origin}/api/v4/projects/${safeProjectId}/repository/branches?search=${encodeURIComponent(searchPrefix)}`;
  } else if (branchesUrl) {
    targetUrl = branchesUrl;
  }

  if (!targetUrl || !token) {
    setResponseStatus(event, 500);
    return { error: "服务端未配置 GITLAB_BASE_URL+GITLAB_PROJECT_ID 或 GITLAB_BRANCHES_URL，或者缺失 GITLAB_PRIVATE_TOKEN" };
  }

  return {
    url: buildGitlabBranchesUrl(targetUrl, token),
    branchPrefix: config.gitlabBranchPrefix || "feature/",
  };
});
