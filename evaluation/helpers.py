from io import BytesIO
import IPython.display
import numpy as np
import urllib
import PIL.Image
from scipy.stats import truncnorm
from skimage import io, data, transform  # pip install scikit-image
import requests
from tensorflow.python.framework import ops
import tensorflow_hub as hub
import scipy.misc
from tqdm import tqdm
from random import random
import cv2  # pip install opencv-python
import tensorflow.compat.v1 as tf
tf.disable_v2_behavior() 


class GANSession:
    def __init__(self, module_path):
        ops.reset_default_graph()
        print('Loading BigGAN module from:', module_path)
        self.module = hub.Module(module_path)
        self.inputs = {k: tf.placeholder(v.dtype, v.get_shape().as_list(), k)
                       for k, v in self.module.get_input_info_dict().items()}
        self.output = self.module(self.inputs)

        print("\n")
        print('Inputs:\n', '\n'.join('  {}: {}'.format(*kv)
                                     for kv in self.inputs.items()))
        print("\n")
        print('Output:', self.output)

        self.input_z = self.inputs['z']
        self.input_y = self.inputs['y']
        self.input_trunc = self.inputs['truncation']

        self.dim_z = self.input_z.shape.as_list()[1]
        self.vocab_size = self.input_y.shape.as_list()[1]

        # Create a TensorFlow session and initialize variables
        initializer = tf.global_variables_initializer()
        self.sess = tf.Session()
        self.sess.run(initializer)

    def truncated_z_sample(self, batch_size, truncation=1., seed=None):
        state = None if seed is None else np.random.RandomState(seed)
        values = truncnorm.rvs(-2, 2, size=(batch_size,
                                            self.dim_z), random_state=state)
        return truncation * values

    def one_hot(self, index, vocab_size=None):
        if(not vocab_size):
            vocab_size = self.vocab_size
        index = np.asarray(index)
        if len(index.shape) == 0:
            index = np.asarray([index])
        assert len(index.shape) == 1
        num = index.shape[0]
        output = np.zeros((num, vocab_size), dtype=np.float32)
        output[np.arange(num), index] = 1
        return output

    def one_hot_if_needed(self, label, vocab_size=None):
        if(not vocab_size):
            vocab_size = self.vocab_size
        label = np.asarray(label)
        if len(label.shape) <= 1:
            label = self.one_hot(label, vocab_size)
        assert len(label.shape) == 2
        return label

    def sample(self, noise, label, truncation=1., batch_size=8, vocab_size=None):
        sess = self.sess
        if(not vocab_size):
            vocab_size = self.vocab_size
        noise = np.asarray(noise)
        label = np.asarray(label)
        num = noise.shape[0]
        if len(label.shape) == 0:
            label = np.asarray([label] * num)
        if label.shape[0] != num:
            raise ValueError('Got # noise samples ({}) != # label samples ({})'
                             .format(noise.shape[0], label.shape[0]))
        label = self.one_hot_if_needed(label, vocab_size)
        ims = []
        for batch_start in tqdm(range(0, num, batch_size)):
            s = slice(batch_start, min(num, batch_start + batch_size))
            feed_dict = {self.input_z: noise[s],
                         self.input_y: label[s], self.input_trunc: truncation}
            ims.append(sess.run(self.output, feed_dict=feed_dict))
        ims = np.concatenate(ims, axis=0)
        assert ims.shape[0] == num
        ims = np.clip(((ims + 1) / 2.0) * 256, 0, 255)
        ims = np.uint8(ims)
        return ims

    def interpolate(self, A, B, num_interps):
        alphas = np.linspace(0, 1, num_interps)
        if A.shape != B.shape:
            raise ValueError(
                'A and B must have the same shape to interpolate.')
        return np.array([(1-a)*A + a*B for a in alphas])

    def imgrid(self, imarray, cols=5, pad=1):
        if imarray.dtype != np.uint8:
            raise ValueError('imgrid input imarray must be uint8')
        pad = int(pad)
        assert pad >= 0
        cols = int(cols)
        assert cols >= 1
        N, H, W, C = imarray.shape
        rows = int(np.ceil(N / float(cols)))
        batch_pad = rows * cols - N
        assert batch_pad >= 0
        post_pad = [batch_pad, pad, pad, 0]
        pad_arg = [[0, p] for p in post_pad]
        imarray = np.pad(imarray, pad_arg, 'constant', constant_values=255)
        H += pad
        W += pad
        grid = (imarray
                .reshape(rows, cols, H, W, C)
                .transpose(0, 2, 1, 3, 4)
                .reshape(rows*H, cols*W, C))
        if pad:
            grid = grid[:-pad, :-pad]
        return grid

    def interpolate_and_shape(self, A, B, num_samples, num_interps):
        interps = self.interpolate(A, B, num_interps)
        return (interps.transpose(1, 0, *range(2, len(interps.shape)))
                .reshape(num_samples * num_interps, -1))

    def get_interpolated_yz(self, categories_all, num_interps, noise_seed_A, noise_seed_B, truncation):
        nt = len(categories_all)
        num_samples = 1
        z_A, z_B = [self.truncated_z_sample(num_samples, truncation, noise_seed)
                    for noise_seed in [noise_seed_A, noise_seed_B]]
        y_interps = []
        for i in range(nt):
            category_A, category_B = categories_all[i], categories_all[(
                i+1) % nt]
            y_A, y_B = [self.one_hot([category] * num_samples)
                        for category in [category_A, category_B]]
            y_interp = self.interpolate_and_shape(
                np.array(y_A), np.array(y_B), num_samples, num_interps)
            y_interps.append(y_interp)
        y_interp = np.vstack(y_interps)
        z_interp = self.interpolate_and_shape(
            z_A, z_B, num_samples, num_interps * nt)

        return y_interp, z_interp

    def get_transition_yz(self, classes, num_interps, truncation):
        noise_seed_A, noise_seed_B = 10, 20   # fix this!
        return self.get_interpolated_yz(classes, num_interps, noise_seed_A, noise_seed_B, truncation=truncation)

    def get_random_yz(self, num_classes, num_interps, truncation):
        random_classes = [int(1000*random()) for i in range(num_classes)]
        return self.get_transition_yz(random_classes, num_interps, truncation=truncation)

    def get_combination_yz(self, categories, noise_seed, truncation):
        z = np.vstack([self.truncated_z_sample(1, truncation, noise_seed)]
                      * (len(categories)+1))
        y = np.zeros((len(categories)+1, 1000))
        for i, c in enumerate(categories):
            y[i, c] = 1.0
            y[len(categories), c] = 1.0
        return y, z

    def slerp(self, A, B, num_interps):  # see https://en.wikipedia.org/wiki/Slerp
        # each unit step tends to be a 90 degree rotation in high-D space, so this is ~360 degrees
        alphas = np.linspace(-1.5, 2.5, num_interps)
        omega = np.zeros((A.shape[0], 1))
        for i in range(A.shape[0]):
            tmp = np.dot(A[i], B[i]) / \
                (np.linalg.norm(A[i])*np.linalg.norm(B[i]))
            omega[i] = np.arccos(np.clip(tmp, 0.0, 1.0))+1e-9
        return np.array([(np.sin((1-a)*omega)/np.sin(omega))*A + (np.sin(a*omega)/np.sin(omega))*B for a in alphas])

    def slerp_and_shape(self, A, B, num_interps):
        interps = self.slerp(A, B, num_interps)
        return (interps.transpose(1, 0, *range(2, len(interps.shape)))
                .reshape(num_interps, *interps.shape[2:]))

    def imshow(self, a, format='png', jpeg_fallback=True):
        a = np.asarray(a, dtype=np.uint8)
        str_file = BytesIO()
        PIL.Image.fromarray(a).save(str_file, format)
        png_data = str_file.getvalue()
        try:
            disp = IPython.display.display(IPython.display.Image(png_data))
        except IOError:
            if jpeg_fallback and format != 'jpeg':
                print('Warning: image was too large to display in format "{}"; '
                       'trying jpeg instead.').format(format)
                return self.imshow(a, format='jpeg')
            else:
                raise
        return disp
