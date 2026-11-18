import { sync, route } from '../server/handlers.js';

export default route(sync, { method: 'POST' });
