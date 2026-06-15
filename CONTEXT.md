# 飞书项目 MCP 集成

将公司 GitLab 分支与飞书项目工作项打通的内网工具服务。

## Language

**工作项 (Work Item)**:
飞书项目中的一条需求或任务记录，由工作项单号唯一标识。
_Avoid_: 需求、任务、ticket

**工作项单号 (Work Item No)**:
工作项的唯一标识符，从 GitLab feature 分支名中解析得到（去掉前缀后的部分）。
_Avoid_: 需求编号、ID

**同步快照 (Sync Snapshot)**:
一次分支同步操作的结果，包含同步时间戳和所有分支需求映射条目。系统只保留最新一次。
_Avoid_: 同步记录、缓存

**分支需求映射 (Branch-WorkItem Mapping)**:
单条 `{ branch, workItemId, info }` 三元组，表示一个 GitLab feature 分支与其对应飞书工作项的关联关系。
_Avoid_: 映射关系、分支信息

**会话令牌 (Session Token)**:
前端持有的不可逆凭证，代理真实飞书 access_token 与后端通信。真实 token 不下发给前端。
_Avoid_: token、access_token
