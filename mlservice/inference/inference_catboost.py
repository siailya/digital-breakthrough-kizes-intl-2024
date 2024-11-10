import mne
import numpy as np
import numpy.typing as npt

from catboost import CatBoostClassifier
from scipy.stats import skew, kurtosis


def feature_data(raw_data: np.ndarray) -> np.ndarray:
    means = np.mean(raw_data, axis=-1)
    median = np.median(raw_data, axis=-1)
    sigmas = np.std(raw_data, axis=-1)
    percentile95 = np.percentile(raw_data, q=0.95, axis=-1)
    percentile05 = np.percentile(raw_data, q=0.05, axis=-1)
    # percentile75 = np.percentile(raw_data, q=0.75, axis=-1)
    # percentile35 = np.percentile(raw_data, q=0.35, axis=-1)
    # cv = np.std(raw_data, ddof=1, axis=1) / np.mean(raw_data, axis=1)
    # sk = skew(raw_data, axis=1, bias=True)
    # kurt = kurtosis(raw_data, axis=1, bias=True)
    fourie_means = np.array([extract_fft_features_fixed_freqs(raw_line)[0].flatten() for raw_line in raw_data])
    return np.concatenate(
        # (means, median, sigmas, percentile95, percentile05, percentile75, percentile35, cv, sk, kurt, fourie_means),
        (means, median, sigmas, percentile95, percentile05, fourie_means),
        axis=-1
    )


def extract_fft_features_fixed_freqs(
        raw_data: np.ndarray,
        sample_rate: int = 400,
        target_freqs: npt.ArrayLike | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    raw_data = np.asarray(raw_data)

    if target_freqs is None:
        target_freqs = np.arange(0.01, 25.1, 0.01)
    else:
        target_freqs = np.asarray(target_freqs)
    N = raw_data.shape[1]
    freqs = np.fft.rfftfreq(N, d=1.0 / sample_rate)
    features = []
    for channel_data in raw_data:
        fft_values = np.fft.rfft(channel_data)
        fft_magnitudes = np.abs(fft_values)
        interpolated_magnitudes = np.interp(target_freqs, freqs, fft_magnitudes)
        features.append(interpolated_magnitudes)

    features = np.array(features)
    return features, target_freqs


def segment_time_series(
        data: npt.ArrayLike,
        sample_interval: int,
        sample_shift: int
):
    data = np.asarray(data)
    num_samples = data.shape[1]

    num_segments = 1 + (num_samples - sample_interval) // sample_shift

    segments = []
    times = []
    for i in range(num_segments):
        start_idx = i * sample_shift
        end_idx = start_idx + sample_interval

        if end_idx <= num_samples:
            segment = data[:, start_idx:end_idx]
            segments.append(segment)
            times.append([start_idx, end_idx])
        else:
            break

    segments = np.array(segments)
    times = np.array(times)
    return segments, times


def merge_intervals_by_class(
        intervals: npt.ArrayLike,
        labels: npt.ArrayLike,
        labels_proba: npt.ArrayLike
):
    if len(intervals) == 0:
        return np.array([]), np.array([])

    merged_intervals = []
    merged_labels = []
    merged_probas = []

    current_interval = intervals[0].copy()
    current_label = labels[0]

    counter = 1
    sum_probs = labels_proba[0]

    for i in range(1, len(intervals)):
        next_interval = intervals[i]
        next_label = labels[i]
        next_proba = labels_proba[i]

        if next_label == current_label:
            current_interval[1] = next_interval[1]
            sum_probs += next_proba
            counter += 1
        else:
            merged_intervals.append(current_interval)
            merged_labels.append(current_label)
            merged_probas.append(sum_probs / counter)
            current_interval = next_interval.copy()
            current_label = next_label
            sum_probs = next_proba
            counter = 1

    merged_intervals.append(current_interval)
    merged_labels.append(current_label)
    merged_probas.append(sum_probs / counter)

    return np.array(merged_intervals), np.array(merged_labels), np.array(merged_probas)


def assign_bins_by_majority_class(
        intervals: npt.ArrayLike,
        labels: npt.ArrayLike,
        labels_prob: npt.ArrayLike,
        max_sample: int,
        n_bin_samples: int
) -> tuple[np.ndarray, np.ndarray]:
    intervals = np.asarray(intervals)
    labels = np.asarray(labels)
    labels_prob = np.asarray(labels_prob)

    num_samples = max_sample + 1
    N_bins = (num_samples + n_bin_samples - 1) // n_bin_samples

    bins = []

    for bin_index in range(N_bins):
        bin_start = bin_index * n_bin_samples
        bin_end = min((bin_index + 1) * n_bin_samples - 1, max_sample)

        overlaps = (intervals[:, 1] >= bin_start) & (intervals[:, 0] <= bin_end)
        bin_labels = labels[overlaps]
        prob_labels = labels_prob[overlaps].mean(axis=0)

        if len(bin_labels) == 0:
            bin_class = 0
            bin_class_prob = 1
        else:
            unique_labels, counts = np.unique(bin_labels, return_counts=True)
            max_count = np.max(counts)
            max_labels = unique_labels[counts == max_count]

            if len(max_labels) == 1:
                bin_class = max_labels[0]
                bin_class_prob = prob_labels[max_labels[0]]
            else:
                non_zero_labels = max_labels[max_labels != 0]
                if len(non_zero_labels) > 0:
                    bin_class = non_zero_labels[0]
                    bin_class_prob = prob_labels[non_zero_labels[0]]
                else:
                    bin_class = 0
                    bin_class_prob = 1
        bins.append([bin_start, bin_end, bin_class, bin_class_prob])
    bins = np.array(bins)
    return bins[:, :2].astype(int), bins[:, 2].astype(int), bins[:, 3].astype(float)


def assign_bins_by_majority_class_with_prob(
        intervals: npt.ArrayLike,
        labels: npt.ArrayLike,
        labels_prob: npt.ArrayLike,
        max_sample: int,
        n_bin_samples: int
) -> tuple[np.ndarray, np.ndarray]:
    intervals = np.asarray(intervals)
    labels = np.asarray(labels)
    labels_prob = np.asarray(labels_prob)

    num_samples = max_sample + 1
    N_bins = (num_samples + n_bin_samples - 1) // n_bin_samples

    bins = []
    bin_probs = []

    for bin_index in range(N_bins):
        bin_start = bin_index * n_bin_samples
        bin_end = min((bin_index + 1) * n_bin_samples, max_sample)

        overlaps = (intervals[:, 1] >= bin_start) & (intervals[:, 0] <= bin_end)
        bin_labels = labels[overlaps]
        prob_labels = labels_prob[overlaps].mean(axis=0)

        if len(bin_labels) == 0:
            bin_class = 0
            bin_class_prob = np.array([1, 0, 0, 0])
        else:
            unique_labels, counts = np.unique(bin_labels, return_counts=True)
            max_count = np.max(counts)
            max_labels = unique_labels[counts == max_count]

            if len(max_labels) == 1:
                bin_class = max_labels[0]
                bin_class_prob = prob_labels
            else:
                non_zero_labels = max_labels[max_labels != 0]
                if len(non_zero_labels) > 0:
                    bin_class = non_zero_labels[0]
                    bin_class_prob = prob_labels
                else:
                    bin_class = 0
                    bin_class_prob = np.array([1, 0, 0, 0])

        bins.append([bin_start, bin_end, bin_class])
        bin_probs.append(bin_class_prob)
    bins = np.array(bins)
    bin_probs = np.array(bin_probs)
    return bins[:, :2].astype(int), bins[:, 2].astype(int), bin_probs


def read_data(file_path: str):
    return mne.io.read_raw_edf(file_path, preload=True)


def predict(
        model,
        raw_data: np.ndarray,
        max_time: int,
        sample_ratio: int = 400,
        time_interval: float = 0.5,
        time_shift: float = 0.5,
        bin_time: float = 1
) -> tuple[np.ndarray, np.ndarray]:
    sample_interval = int(sample_ratio * time_interval)
    sample_shift = int(sample_ratio * bin_time)
    n_bin_samples = int(sample_ratio * time_shift)
    max_sample = int(sample_ratio * max_time)

    segments, samples = segment_time_series(raw_data, sample_interval, sample_shift)
    print("Segmented")
    X = feature_data(segments)
    print("Feature data")
    y_pred = model.predict(X)
    print("Y_Pred")
    y_pred_proba = model.predict_proba(X)
    print("Y_Pred_Proba")

    samples, y_pred, y_pred_proba = assign_bins_by_majority_class(
        samples,
        y_pred,
        y_pred_proba,
        max_sample,
        n_bin_samples
    )
    print("Assigned bins")

    samples, y_pred, y_pred_proba = merge_intervals_by_class(samples, y_pred, y_pred_proba)
    print("Merged intervals")

    times, y_pred_without_0, y_pred_proba_without_0 = (samples / sample_ratio).astype(int)[y_pred != 0], y_pred[
        y_pred != 0], y_pred_proba[y_pred != 0]

    return times, y_pred_without_0, y_pred_proba_without_0


def predict_by_each_bin(
        model,
        raw_data: np.ndarray,
        max_time: int,
        sample_ratio: int = 400,
        time_interval: float = 0.5,
        time_shift: float = 0.5,
        bin_time: float = 1
) -> tuple[np.ndarray, np.ndarray]:
    sample_interval = int(sample_ratio * time_interval)
    sample_shift = int(sample_ratio * time_shift)
    n_bin_samples = int(sample_ratio * bin_time)
    max_sample = int(sample_ratio * max_time)

    segments, samples = segment_time_series(raw_data, sample_interval, sample_shift)
    X = feature_data(segments)
    y_pred = model.predict(X)
    y_pred_proba = model.predict_proba(X)

    samples, y_pred, y_pred_proba = assign_bins_by_majority_class_with_prob(
        samples,
        y_pred,
        y_pred_proba,
        max_sample,
        n_bin_samples
    )

    return (samples / sample_ratio), y_pred, y_pred_proba


model = CatBoostClassifier().load_model("inference/models/catboost_10k_25hz.cbm")
print("Catboost model loaded")


def inference_catboost(file_path):
    print("Process " + file_path)
    data = read_data(file_path)
    raw_data = data.get_data()
    
    times, y_pred, y_pred_proba = predict(
        model,
        raw_data,
        data.times[-1],
        time_interval=5,
        time_shift=2,
        bin_time=1
    )
    
    # Clean up large data objects
    data.close()
    del data
    del raw_data
    
    return times, y_pred, y_pred_proba
