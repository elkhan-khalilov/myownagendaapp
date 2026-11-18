import { recoveryReset, route } from '../../server/handlers.js';

export default route(recoveryReset, { method: 'POST' });
