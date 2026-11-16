// Site adapter around the unchanged CreatorPromote shared client.
import {createHubClient, validateFeed} from './creatorpromote-hub.js';

export function createCreatorFeed(config, options = {}) {
  const {slug, channelId, hubUrl = 'https://api.creatorpromote.com'} = config;
  if (!/^[A-Za-z0-9_-]{24}$/.test(channelId || '') || !channelId.startsWith('UC')) {
    throw Error('A verified channel ID is required');
  }
  const check = data => {
    validateFeed(data, slug);
    if (data.channel.id !== channelId) throw Error('Unexpected creator channel');
    return data;
  };
  const fetcher = options.fetcher || globalThis.fetch;
  const client = createHubClient({...options, baseUrl:hubUrl, fetcher:async (...args) => {
    const response = await fetcher(...args);
    if (!response.ok) return response;
    const data = check(await response.json());
    return {ok:true, json:async () => data};
  }});
  const checked = value => {check(value.data); return value;};
  return {
    get:async options => checked(await client.get(slug, options)),
    subscribe:(onData, onError = () => {}) => client.subscribe(slug, value => {
      try {onData(checked(value));} catch {onError(Error('Creator feed unavailable'));}
    }, onError)
  };
}

// Keep live expiry timers and refreshes active after browser back/forward navigation.
export function watchCreatorFeed(config, onData, onError) {
  const client = createCreatorFeed(config);
  let stop, disposed = false, lastSource;
  const emit = value => {
    // Resubscribing after a failed manual refresh must keep the fallback notice.
    if (value.source === 'cache' && lastSource === 'fallback') value = {...value,source:'fallback'};
    lastSource = value.source;
    onData(value);
  };
  const pause = () => {stop?.(); stop = undefined;};
  const start = () => {if (!disposed && !stop) stop = client.subscribe(emit, onError);};
  globalThis.addEventListener('pagehide', pause);
  globalThis.addEventListener('pageshow', start);
  start();
  return {
    async refresh() {
      try {emit(await client.get({force:true}));}
      catch (error) {onError(error);}
      finally {pause(); start();}
    },
    dispose() {
      disposed = true; pause();
      globalThis.removeEventListener('pagehide', pause);
      globalThis.removeEventListener('pageshow', start);
    }
  };
}
