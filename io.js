// global Buffer: true
const http = require('request-promise-native');
var IO = () => { throw new Error('This is a static class! (IO.constructor)'); };

IO._request = (method, url, data, transform) => {
    var options = {
        method: method,
        uri: url,
        json: true
    };
    options[(method === 'GET') ? 'qs' : 'body'] = data;
    if(typeof transform !== 'undefined') {
        options.transform = transform;
    }
    return http(options);
};

IO.get = (url, data, transform) => IO._request('GET', url, data, transform);
IO.post = (url, data, transform) => IO._request('POST', url, data, transform);

IO.api = (wiki, action, data, transform) => {
    if(typeof action === 'undefined') {
        throw new Error('`action` parameter not supplied (IO.api)');
    }
    data.action = action;
    data.format = 'json';
    return IO.get(`http://${wiki}.wikia.com/api.php`, data, (data) => {
        if(data.error) {
            var err = data.error;
            throw new Error(`MediaWiki API error: ${err.code}: ${err.info}`);
        } else if (typeof data[action] === 'undefined') {
            console.log('error2 yay');
            throw new Error('MediaWiki API returned no data!');
        } else if(typeof transform === 'undefined') {
            return data;
        } else {
            return transform(data);
        }
    });
};

module.exports = { // jshint ignore: line
    get: IO.get,
    post: IO.post,
    api: IO.api,
    webhook: IO.webhook
};
