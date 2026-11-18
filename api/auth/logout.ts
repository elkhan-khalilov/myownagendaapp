import { logout, route } from '../../server/handlers.js';

export default route(logout, { method: 'POST' });
