import { removeDevice, route } from '../../server/handlers';

export default route(removeDevice, { method: 'POST' });
