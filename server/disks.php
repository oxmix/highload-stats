#!/usr/bin/env php
<?php

echo disksPoll::info();

class disksPoll {
	public static $data = [
		'out'  => [],
		'time' => 0
	];

	public static function info() {
		date_default_timezone_set('UTC');

		$smartCtl = trim(strstr(shell_exec('whereis -b smartctl'), ' '));
		if (empty($smartCtl)) {
			self::$data = [
				'out'  => ['smartctl' => 'not found'],
				'time' => time()
			];

			return json_encode(self::$data);
		}

		$out = [];

		// nvme
		$disks = explode(PHP_EOL, trim(shell_exec($smartCtl.' -d nvme --scan')));
		if (!empty($disks) && stripos($disks[0], 'aborted matching') === false) {
			foreach ($disks as $disk) {
				if (empty($disk))
					continue;

				$src = shell_exec($smartCtl.' -a '.strtok($disk, ' '));

				if (empty($src))
					continue;

				$out[$disk]['test'] = self::parseTest($src);

				$out[$disk]['info'] = self::parseInfo($src);

				$out[$disk]['smarts'] = self::parseSmart($src);
			}
		}

		// sata
		$disks = explode(PHP_EOL, trim(shell_exec($smartCtl.' --scan')));
		foreach ($disks as $disk) {
			if (empty($disk))
				continue;

			// lsi
			if (stripos($disk, 'megaraid') !== false) {
				preg_match('/(.+) -d ([a-z0-9,]+) #/si', $disk, $o);
				$src = shell_exec($smartCtl.' -a -d '.$o[2].' '.$o[1]);
			} else {
				$src = shell_exec($smartCtl.' -a '.strtok($disk, ' '));
			}

			if (empty($src))
				continue;

			$out[$disk]['test'] = self::parseTest($src);

			$out[$disk]['info'] = self::parseInfo($src);

			$out[$disk]['smarts'] = self::parseSmart($src);
		}

		if (file_exists(__DIR__.'/.raid')) {
			$fgc = file_get_contents(__DIR__.'/.raid');
			list($dev, $quantity) = explode('=', $fgc, 2);
			$out = self::cciss($smartCtl, $dev, trim($quantity), $out);
		}

		self::$data['out'] = $out;
		self::$data['time'] = time();

		return json_encode(self::$data);
	}

	private static function cciss($smartCtl = '/usr/sbin/smartctl', $device = '/dev/sda', $disks = 3, $out = []) {
		for ($i = 0; $i <= $disks - 1; $i++) {
			$src = shell_exec($smartCtl.' -a '.$device.' -d cciss,'.$i);
			$disk = $device.'.cciss.'.$i;
			if (empty($src))
				continue;

			$out[$disk]['test'] = self::parseTest($src);
			$out[$disk]['info'] = self::parseInfo($src);
			$out[$disk]['smarts'] = self::parseSmart($src);
		}

		return $out;
	}

	private static function parseTest($src) {
		$test = '';
		if (preg_match('#SMART overall-health self-assessment test result: (.*?)(\n\n|\n)#i', $src, $o)) {
			$test = trim($o[1]);
		} else {
			if (preg_match('#SMART Health Status: (.*?)(\n\n|\n)#i', $src, $o))
				$test = trim($o[1]);
		}

		return $test;
	}

	private static function parseInfo($src) {
		$info = [];
		if (preg_match('#START OF INFORMATION.*?===\n(.*?)\n\n#si', $src, $o)) {
			if (preg_match_all('#(.*?):\s+(.*)\n#', $o[1], $o, PREG_SET_ORDER)) {
				foreach ($o as $e)
					$info[$e[1]] = $e[2];
			}
		} else {
			if (preg_match_all('#(.*?):\s+(.*)\n#', $src, $o, PREG_SET_ORDER)) {
				foreach ($o as $e)
					$info[$e[1]] = $e[2];
			}
		}

		return $info;
	}

	private static function parseSmart($src) {
		$smarts = [];

		if (preg_match('#Vendor Specific SMART.*?:\n(.*?)\n\n#si', $src, $o)) {
			if (preg_match_all('#([0-9]+) (.*?)\s+.*?\s+.*?\s+.*?\s+.*?\s+(.*?)\s+(.*?)\s+(.*?)\s+(.*?)(\n|$)#si',
				$o[1], $os, PREG_SET_ORDER)) {
				foreach ($os as $e) {
					$smarts[$e[2]] = [
						'id'         => $e[1],
						'name'       => str_replace('_', ' ', $e[2]),
						'type'       => $e[3],
						'update'     => $e[4],
						'whenFailed' => $e[5],
						'value'      => $e[6]
					];
				}
			}
		} elseif (preg_match('#SMART/Health Information.*?\n(.*?)\n\n#si', $src, $o)) {
			if (preg_match_all('#(.*?):.*?(.*?)(\n|$)#si',
				$o[1], $os, PREG_SET_ORDER)) {
				foreach ($os as $e) {
					$smarts[$e[1]] = trim($e[2]);
				}
			}
		}

		if (preg_match('#Current Drive Temperature:(.*?)\n#si', $src, $o)) {
			$smarts['Temperature_Celsius'] = [
				'value' => $o[1]
			];
		}

		return $smarts;
	}
}