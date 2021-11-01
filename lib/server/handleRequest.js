var http = require('http');
var https = require('https');

module.exports = function Smoke(req, res, ctx) {
  Object.assign(this, ctx)
  var proxy = {host: (this.getRequestUrl(req).replace(/(https:\/\/|http:\/\/|\/$)/g, '')).split('/')[0],path: (this.getRequestUrl(req)).split('/')[(this.getRequestUrl(req)).split('/').length - 1],url: this.getRequestUrl(req),docTitle: this.config.docTitle}

  proxy.options = {
    headers: {},
    method: req.method || 'GET'
  };

  if (req.headers['referer']) proxy.options['referer'] = req.headers['referer']

  if (req.headers['origin']) proxy.options['origin'] = req.headers['origin']

  //if (req.headers['cookie']) proxy.options['cookie'] = req.headers['cookie']

  try {new URL(proxy.url)} catch(err) {return res.end('Invalid URL: '+proxy.url+', '+err)}

  proxy.spliceURL = new URL(proxy.url)

  var inject = {url: ctx.url,prefix: ctx.prefix,host: new URL(ctx.url).hostname}

  /*if (proxy.options.headers['cookie']) {        
    var array = [],
    newCookie = proxy.options.headers['cookie'].split('; ');
    newCookie.forEach(cookie => {
      var cname = cookie.split('=')+''
      var cvalue = cookie.split('=')+''
      if (proxy.spliceURL.hostname.includes(cookie.split('@').splice(1).join())) array.push(cname.split('@').splice(0, 1).join() + '=' + cvalue);
    });
    proxy.options.headers['cookie'] = array.join('; ');
  };*/

  var requestProtocol = proxy.url.startsWith('https://') ? https : http

  ctx.url = ctx.url.split('-')[0]

  if (ctx.url.endsWith(',jq.oar')) {
    ctx.url = ctx.url.replace(ctx.url.split('/')[ctx.url.split('/').length - 1], '').replace(/\/$/, '')
  }

  /*if (req.url.endsWith('/')) {
    return res.writeHead(301, {location: req.url.replace(/\/$/g, '')}).end('')
  }*/

  var requestMain = requestProtocol.request(ctx.url, proxy.options, response => {
    let pData = []
    let sendData = ''
    response.on('data', (data) => {pData.push(data)}).on('end', () => {

      Object.entries(response.headers).forEach(([header_name, header_value]) => {
          if (header_name == 'set-cookie') {
              const cookie_array = [];
              header_value.forEach(cookie => cookie_array.push(cookie.replace(/Domain=(.*?);/gi, `Domain=` + req.headers['host'] + ';').replace(/(.*?)=(.*?);/, '$1' + '@' + proxy.spliceURL.hostname + `=` + '$2' + ';')));
              response.headers[header_name] = cookie_array;
  
          };
  
          if (header_name.startsWith('content-encoding') || header_name.startsWith('x-') || header_name.startsWith('cf-') || header_name.startsWith('strict-transport-security') || header_name.startsWith('content-security-policy') || header_name.startsWith('content-length')) delete response.headers[header_name];
  
          if (header_name == 'location') response.headers[header_name] = new ctx.rewrite.Base(ctx).url(header_value)
      });

      sendData = Buffer.concat(pData)
      if (!response.headers['content-type']) {
        response.headers['content-type'] = 'text/plain; charset=UTF-8'
      }
      if (response.headers['content-type'].startsWith('text/html')) {
        sendData = ctx.rewrite.HTMLRewriter(sendData.toString(), ctx)
      } else if (response.headers['content-type'].startsWith('application/javascript')) {
        sendData = ctx.rewrite.JSRewriter(sendData.toString(), ctx)
      } else if (response.headers['content-type'].startsWith('text/css')) {
        sendData = ctx.rewrite.CSSRewriter(sendData.toString(), ctx)
      }

      res.writeHead(response.statusCode, response.headers).end(sendData)
    })
  }).on('error', err => res.end('Error: '+err)).end()
  if (!res.writableEnded) {
    req.on('data', (data) => requestMain.write(data)).on('end', () => requestMain.end())
  }
}