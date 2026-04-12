import { createEditorConfig } from '@audiocontrol/editor-core/vite';

export default createEditorConfig({
  port: 3300,
  dirname: __dirname,
  proxy: {
    '/scsi-bridge': {
      // Use IPv4 explicitly — s3k.local resolves to IPv6 which times out
      target: 'http://10.0.0.57:7033',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/scsi-bridge/, ''),
      ws: true,
    },
  },
});
