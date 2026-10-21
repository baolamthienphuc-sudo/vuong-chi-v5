export const githubClient = env => {
  const owner = env.GITHUB_OWNER || 'baolamthienphuc-sudo';
  const repo = env.GITHUB_REPO || 'vuong-chi-v5';
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return async (path, init = {}) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'vuong-chi-admin',
        ...(init.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const conflict = response.status === 409 || (response.status === 422 && path.startsWith('/git/refs/'));
      const message = conflict
        ? 'Nội dung vừa được cập nhật ở phiên khác. Hãy tải lại danh sách và thử lại.'
        : response.status === 401 || response.status === 403
          ? 'Không thể truy cập kho nội dung. Vui lòng kiểm tra quyền GitHub token trên Cloudflare.'
          : `Không thể cập nhật kho nội dung (GitHub ${response.status}).`;
      throw Object.assign(new Error(message), { status: conflict ? 409 : 502 });
    }
    return data;
  };
};
