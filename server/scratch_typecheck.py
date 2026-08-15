import numpy as np
import cv2
import statistics


def f(frame: np.ndarray) -> float:
    gray_arr = np.asarray(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
    lap_arr = np.asarray(cv2.Laplacian(gray_arr, cv2.CV_64F))
    blur = statistics.pvariance(list(lap_arr.flat))
    brightness = statistics.fmean(list(gray_arr.flat))
    indices = cv2.dnn.NMSBoxes([(0, 0, 1, 1)], [0.5], 0.32, 0.45)
    out = []
    for i in np.asarray(indices).flatten():
        out.append(int(i))
    return blur + brightness + float(len(out))




