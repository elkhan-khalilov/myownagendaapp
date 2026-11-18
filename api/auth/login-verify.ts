import { loginVerify, route } from '../../server/handlers.js';

export default route(loginVerify, { method: 'POST' });
