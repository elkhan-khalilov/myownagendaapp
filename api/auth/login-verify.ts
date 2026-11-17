import { loginVerify, route } from '../../server/handlers';

export default route(loginVerify, { method: 'POST' });
