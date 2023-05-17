import ffmpeg = require("fluent-ffmpeg");

export interface PreviewOptions {
	partCount: number;
	partLengthInSeconds: number;
	size: number;
}

export async function buildPreview(
	inputFilePath: string,
	outputFilePath: string,
	options: Partial<PreviewOptions>,
): Promise<void> {
	const o = {
		partCount: 5,
		partLengthInSeconds: 2,
		size: 256,
		...options,
	};

	const opts = {
		...o,
		parts: o.partCount.toFixed(0),
		size: o.size.toFixed(0),
	};

	const probe = await ffprobe(inputFilePath);
	const durationSeconds = probe.format.duration;
	if (durationSeconds === undefined) {
		throw new Error("Could not decode duration.");
	}

	let partSelectorFilters: string[] = [];

	// The preview video will be partLengthInSeconds * partCount long
	// In case the full video is shorter, we just re-encode the whole video (with the cropped size)
	if (durationSeconds >= o.partLengthInSeconds * o.partCount) {
		const partOffset = durationSeconds / o.partCount;

		// Take only some frames matching the patterns specified after "select=" (see https://superuser.com/a/1189546)
		partSelectorFilters = [
			`select='lt(mod(t\,${partOffset})\,${o.partLengthInSeconds})'`,
			"setpts=N/FRAME_RATE/TB",
		];
	}

	return new Promise((resolve, reject) => {
		ffmpeg(inputFilePath)
			.videoFilters([
				// "crop to fit" $opts.size (see this answer: https://superuser.com/a/1136305)
				`scale=w=${opts.size}:h=${opts.size}:force_original_aspect_ratio=increase`,
				`crop=${opts.size}:${opts.size}`,
				...partSelectorFilters,
			])
			.withOption("-pix_fmt", "yuv420p") // increase compat; see: https://trac.ffmpeg.org/wiki/Encode/VP9
			.noAudio()
			.withOption("-movflags", "+faststart") // optimize video for streaming, especially important for thumbnails (if this applies to VP9)
			.withOption("-c:v", "libvpx-vp9")
			.withOption("-row-mt", "1")
			.withOption("-quality", "good")
			.withOption("-preset", "slow")
			.withOption("-crf", "22")
			.withOption("-b:v", "2000k")
			.withOption("-maxrate", "2500k")
			.once("error", reject)
			.once("end", resolve)
			.save(outputFilePath);
	});
}

function ffprobe(filePath: string): Promise<ffmpeg.FfprobeData> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, data) =>
			err ? reject(err) : resolve(data),
		);
	});
}
