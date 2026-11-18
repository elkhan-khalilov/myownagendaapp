import { status, route } from '../../server/handlers.js';

export default route(status, { method: 'GET' });
