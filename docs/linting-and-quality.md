# 代码质量与 Lint 规范

本项目执行严格的代码质量检查。所有代码必须通过 ESLint、Prettier 和 TypeScript 的严格模式检查。

## 检查工具

- **Lint**: `bun run lint` (eslint)
- **Formatting**: `bun run pretty` (prettier --check)
- **Type Check**: `bun run check` (tsc --noEmit --strict)

## 修复工具

- **自动修复 Lint**: `bun run lint:fix`
- **自动修复格式**: `bun run pretty:fix`

## 严格修复规则

1. **禁止未使用变量**: 所有的 `unused-vars` 必须移除。如果是 catch 子句中不需要 error 对象，使用 `catch { ... }` (ES2019+)。
2. **禁止未使用的表达式**: 严禁将三元运算符或逻辑表达式作为独立语句使用。应使用标准的 `if/else` 语句。
3. **严格类型检查**: TypeScript 必须处于 `--strict` 模式。严禁无故使用 `@ts-ignore` 或 `@ts-expect-error`。如果第三方库缺少类型或存在上游 Bug，必须在注释中说明原因。
4. **文档同步**: 任何逻辑变更必须同步更新 `AGENTS.md` 和 `docs/` 目录下的相关文档。

## 最佳实践 (TypeScript)

- **Make Illegal States Unrepresentable**: 使用辨析联合类型 (Discriminated Unions) 确保状态合法。
- **Runtime Validation**: 对外部数据（API 响应、本地存储）使用 Zod 等工具进行运行时验证。
- **Branded Types**: 对 ID 等原始类型使用 Branded Types 以增强区分度。
- **Exhaustive Checks**: 使用 `never` 类型确保 `switch` 语句处理了所有可能的情况。
