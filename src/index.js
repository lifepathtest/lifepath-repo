export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Block automated vulnerability scanner probing on sensitive dotfiles
    if (url.pathname.startsWith('/.env') || url.pathname.startsWith('/.git')) {
      return new Response('404 Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
