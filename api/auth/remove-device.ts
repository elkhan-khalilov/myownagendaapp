import { removeDevice, route } from '../../server/handlers.js';

export default route(removeDevice, { method: 'POST' });
