import root from '../../eslint.config.js';
export default [...root, { ignores: ['playwright-report/**', 'test-results/**'] }];
