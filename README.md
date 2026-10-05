# One-click code diff & approve

Chặn AI ghi/sửa file và chạy lệnh shell cho tới khi bạn xem diff và bấm Duyệt.

Mỗi lần model gọi tool `write`, `edit` hoặc `bash`, agent dừng lại (`{kind:'ask'}`).
Web UI hiện approval composer sẵn có: diff card (do chính tool `write`/`edit` render),
nút **Allow once** / **Reject**, phím **Enter** / **Esc**.

## Cài

Không có build step, không có dependency. Trong Harness, bảo agent chạy tool
`plugin_manager` với `action: install_bundle` và `target` là thư mục này:

```
/home/Trung/Projects/1-Click Code Diff & Approve
```

Sau đó thêm row plugin vào profile patch — thường `plugin_manager` tự làm.
Kiểm tra bằng `dsh --profile web --dump-config` phải thấy
`one-click-diff-approve` trong danh sách row.

## Chạy thử

```sh
node check.mjs
```

## Files

| File | Vai trò |
|---|---|
| `index.js` | Host plugin — chặn `tools/pre-execute` |
| `cordis.patch.yml` | Khai báo plugin cho Loader |
| `package.json` | Manifest (`dsh.bundle.patch`) |
| `check.mjs` | Self-check, không framework |

Không có `client.js`: UI approval và diff card đã có sẵn trong
`@deepseek-ai/dsh-client-ui-approval` và `@deepseek-ai/dsh-tool-fs`.

## Sửa nhanh

Chỉnh `GUARDED` trong `index.js` để thêm/bớt tool. Mỗi tool cần `title` (nhãn
hiện ra), `field` (tên argument chứa nội dung cần xem), `hint` (câu nhắc):

```js
const GUARDED = {
  write: { title: 'Write a file', field: 'file_path', hint: 'review the diff' },
  edit: { title: 'Edit a file', field: 'file_path', hint: 'review the diff' },
  bash: { title: 'Run a shell command', field: 'command', hint: 'read the command' },
}
```

Lệnh shell dài hơn `MAX_DETAIL` sẽ bị cắt kèm chữ `(truncated)` — có dấu hiệu để
không ai tưởng mình đã đọc hết.

`ponytail:` chưa nhớ "duyệt một lần cho cả session" — `PreToolDecision` chỉ có
`allow` / `deny` / `cancel` / `ask`, không có `allow-always`. Thêm listener vào
`approval/request` trả `'allowed-once'` cho các lệnh chỉ đọc nếu cần giảm số
lần bấm.

`ponytail:` `if (exec.agent === undefined) return next()` là fail-open — lệnh
không gắn với session chat nào (job nền của host) sẽ chạy không cần duyệt.
Xoá dòng đó để chặn chặt: host tự trả `deny` với message rõ ràng.
