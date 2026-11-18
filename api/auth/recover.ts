import { recover, route } from '../../server/handlers.js';

export default route(recover, { method: 'POST' });
