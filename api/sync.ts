import { sync, route } from '../server/handlers';

export default route(sync, { method: 'POST' });
