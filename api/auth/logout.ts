import { logout, route } from '../../server/handlers';

export default route(logout, { method: 'POST' });
