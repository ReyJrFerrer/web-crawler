import * as k8s from '@kubernetes/client-node';
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
k8sApi.listNamespacedPod({ namespace: 'default' }).then((res) => {
    console.log(res.items.map(p => p.metadata?.name));
}).catch(console.error);
