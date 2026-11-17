import { recoveryReset, route } from '../../server/handlers';

export default route(recoveryReset, { method: 'POST' });
