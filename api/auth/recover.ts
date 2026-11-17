import { recover, route } from '../../server/handlers';

export default route(recover, { method: 'POST' });
