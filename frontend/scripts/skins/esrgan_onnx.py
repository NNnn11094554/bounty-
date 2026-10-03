"""Convert Real-ESRGAN (RRDBNet) .pth to ONNX without torch."""
import pickle, zipfile, sys, numpy as np, onnx
from onnx import helper, numpy_helper, TensorProto

def load_pth(path):
    zf = zipfile.ZipFile(path)
    prefix = zf.namelist()[0].split('/')[0]
    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == '_rebuild_tensor_v2':
                def rebuild(storage, offset, size, stride, *a):
                    dtype, key = storage
                    buf = np.frombuffer(zf.read(f'{prefix}/data/{key}'), dtype=dtype)
                    return np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=[s*buf.itemsize for s in stride]).copy()
                return rebuild
            if name == 'OrderedDict':
                import collections; return collections.OrderedDict
            if name.endswith('Storage'):
                return {'FloatStorage': np.float32, 'HalfStorage': np.float16}[name]
            return super().find_class(mod, name)
        def persistent_load(self, pid):
            return (pid[1], pid[2])
    return U(zf.open(f'{prefix}/data.pkl')).load()

sd = load_pth(sys.argv[1])
if 'params_ema' in sd: sd = sd['params_ema']
nb = 1 + max(int(k.split('.')[1]) for k in sd if k.startswith('body.'))
nodes, inits = [], []
def conv(x, name, out):
    w = sd[name + '.weight'].astype(np.float32); b = sd[name + '.bias'].astype(np.float32)
    inits.append(numpy_helper.from_array(w, name + '.w')); inits.append(numpy_helper.from_array(b, name + '.b'))
    nodes.append(helper.make_node('Conv', [x, name + '.w', name + '.b'], [out], pads=[1,1,1,1], kernel_shape=[3,3]))
    return out
def lrelu(x, out):
    nodes.append(helper.make_node('LeakyRelu', [x], [out], alpha=0.2)); return out
def cat(xs, out):
    nodes.append(helper.make_node('Concat', xs, [out], axis=1)); return out
inits.append(numpy_helper.from_array(np.array(0.2, np.float32), 'k02'))
def resid(x, y, out):
    nodes.append(helper.make_node('Mul', [y, 'k02'], [out + '_m'])); nodes.append(helper.make_node('Add', [out + '_m', x], [out])); return out
def rdb(x, p):
    feats = [x]
    for i in range(1, 5):
        c = cat(feats, f'{p}.c{i}') if len(feats) > 1 else x
        feats.append(lrelu(conv(c, f'{p}.conv{i}', f'{p}.o{i}'), f'{p}.a{i}'))
    x5 = conv(cat(feats, f'{p}.c5'), f'{p}.conv5', f'{p}.o5')
    return resid(x, x5, f'{p}.out')
x = conv('input', 'conv_first', 'feat')
h = x
for i in range(nb):
    y = h
    for r in (1, 2, 3): y = rdb(y, f'body.{i}.rdb{r}')
    h = resid(h, y, f'body.{i}.out')
bt = conv(h, 'conv_body', 'bt')
nodes.append(helper.make_node('Add', ['feat', bt], ['f0']))
inits.append(numpy_helper.from_array(np.array([1,1,2,2], np.float32), 'sc'))
f = 'f0'
for n in (1, 2):
    nodes.append(helper.make_node('Resize', [f, '', 'sc'], [f'up{n}'], mode='nearest'))
    f = lrelu(conv(f'up{n}', f'conv_up{n}', f'cu{n}'), f'lu{n}')
f = lrelu(conv(f, 'conv_hr', 'hr'), 'lhr')
conv(f, 'conv_last', 'output')
g = helper.make_graph(nodes, 'rrdb', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1,3,None,None])],
    [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1,3,None,None])], inits)
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)]); m.ir_version = 8
onnx.checker.check_model(m); onnx.save(m, sys.argv[2]); print('blocks', nb, 'ok')
