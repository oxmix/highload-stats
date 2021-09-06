<style>
	.dit {
		width: 100%;
	}
	.dit td {
		padding: 10px;
		vertical-align: top;
	}

	.dit tbody tr:hover td {
		background-color: #dadada;
	}

	.dit tbody tr:nth-child(even) {
		background-color: #fafafa;
	}

	.dit tbody tr:nth-child(odd) {
		background-color: #eee;
	}

	.dit.list {
		width: 100%;
		background-color: white;
	}

	.dit.list thead td {
		color: grey;
	}

	.dit tbody td {
		border: 1px solid #ddd;
	}

	.dit tbody.focus > tr > td > table:nth-child(1) {
		width: 50%;
		float: left;
	}

	.dit tbody.focus > tr > td > table:nth-child(2) {
		width: 50%;
	}

	.dit tbody.focus tr {
		outline: none;
	}

	.dit tbody.focus tr:nth-child(even) td {
		display: none;
	}

	.dit tbody.focus tr:nth-child(even):focus td,
	.dit tbody.focus tr:focus + tr:nth-child(even) td {
		display: table-cell;
		background: none !important;
	}
</style>

<div>
	<?php
	date_default_timezone_set('UTC');
	$disks = json_decode(file_get_contents("php://stdin") ?: '{}', true);
	if (empty($disks)):?>
		<div>Empty json decode from stdin.</div>
	<?php exit; endif;
		unset($disks['out']['smartctl']);
	?>
	<div>Last update: <?php echo ceil((time() - $disks['time']) / 60)?> min., <?php echo count($disks['out'])?> pc.</div>
	<?php if (!empty($disks) && !empty($disks['mds'])):?>
		<table class="dit">
			<thead>
			<tr>
				<td>Device</td>
				<td>Info</td>
			</tr>
			</thead>
			<tbody class="focus">
			<?php if (!empty($disks['mds'])):foreach ($disks['mds'] as $disk => $info):?>
				<tr tabindex="-1">
					<td data-container="body" title="<?php echo $disk?>" style="width: 80px;"><?php echo $disk?></td>
					<td><?php preg_match('#Raid Level : (.*?) .*? State : (.*?)\n#si', $info, $infoMd); echo $infoMd[1].' / '.$infoMd[2];?></td>
				</tr>
				<tr tabindex="-1">
					<td colspan="2" style="border-top: none;"><pre><?php echo $info?></pre></td>
				</tr>
			<?php endforeach;endif?>
			</tbody>
		</table>
	<?php endif?>
	<?php if (!empty($disks) && !empty($disks['out'])):?>
		<table class="dit">
			<thead>
			<tr>
				<td>Disk</td>
				<td>Test</td>
				<td>Device model</td>
				<td>Capacity</td>
				<td>Working</td>
				<td>Temperature</td>
				<td data-container="body" title="Reallocated Sector Count - Count of reallocated sectors. The raw value represents a count of the bad sectors that have been found and remapped.Thus, the higher the attribute value, the more sectors the drive has had to reallocate. This value is primarily used as a metric of the life expectancy of the drive; a drive which has had any reallocations at all is significantly more likely to fail in the immediate months.">Realloc.</td>
				<td data-container="body" title="Raw Read Error Rate - Stores data related to the rate of hardware read errors that occurred when reading data from a disk surface. The raw value has different structure for different vendors and is often not meaningful as a decimal number. For some drives, this number may increase during normal operation without necessarily signifying errors.">Read Error</td>
				<td data-container="body" title="Seek Error Rate - Rate of seek errors of the magnetic heads. If there is a partial failure in the mechanical positioning system, then seek errors will arise. Such a failure may be due to numerous factors, such as damage to a servo, or thermal widening of the hard disk. The raw value has different structure for different vendors and is often not meaningful as a decimal number. For some drives, this number may increase during normal operation without necessarily signifying errors.">Seek Error</td>
			</tr>
			</thead>
			<tbody class="focus">
			<?php foreach ($disks['out'] as $disk => $d):?>
				<tr tabindex="-1">
					<td data-container="body" title="<?php echo $disk?>" style="width: 80px;"><?php echo strtok($disk, ' ')?></td>
					<td style="color: <?php echo ($d['test'] == 'PASSED' || $d['test'] == 'OK') ? 'yellowgreen' : 'orangered'?>;"><?php echo !empty($d['test']) ? $d['test'] : '–'?></td>
					<td data-container="body" title="<?php echo empty($d['info']['Model Family']) ? '–' : $d['info']['Model Family']?>">
						<?php if (!empty($d['info']['Device Model'])):?>
							<?php echo $d['info']['Device Model']?>
						<?php elseif(!empty($d['info']['Vendor']) && !empty($d['info']['Product'])):?>
							<?php echo $d['info']['Vendor']?> <?php echo $d['info']['Product']?> <?php echo @$d['info']['Revision']?>
						<?php elseif(!empty($d['info']['Model Number'])):?>
							<?php echo $d['info']['Model Number']?>
						<?php else:?>
							–
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['info']['User Capacity'])):?>
							<?php echo str_replace(['[', ']'], '', strstr($d['info']['User Capacity'], '['))?>
						<?php elseif(!empty($d['info']['Total NVM Capacity'])):?>
							<?php echo str_replace(['[', ']'], '', strstr($d['info']['Total NVM Capacity'], '['))?>
						<?php else:?>
							–
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['smarts']['Power_On_Hours'])):?>
							<?php echo round((int)$d['smarts']['Power_On_Hours']['value'] / 24 / 30 / 12, 1)?> years
						<?php elseif(!empty($d['smarts']['Power_On_Hours_and_Msec']['value'])):?>
							<?php echo round((int)$d['smarts']['Power_On_Hours_and_Msec']['value'] / 24 / 30 / 12, 1) ?> years
						<?php elseif(!empty($d['smarts']['Power On Hours'])):?>
							<?php echo round((int)str_replace(',', '', $d['smarts']['Power On Hours']) / 24 / 30 / 12, 1) ?> years
						<?php else:?>
							–
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['smarts']['Temperature_Celsius']['value'])):?>
							<?php echo str_replace('Min/Max ', '', $d['smarts']['Temperature_Celsius']['value'])?>
						<?php elseif(!empty($d['smarts']['Temperature Sensor 1'])):?>
							#1: <?php echo (int)$d['smarts']['Temperature Sensor 1']?>
							<?php if (!empty($d['smarts']['Temperature Sensor 2'])):?>
								| #2: <?php echo (int)$d['smarts']['Temperature Sensor 2']?>
							<?php endif?>
						<?php elseif(!empty($d['smarts']['Airflow_Temperature_Cel']['value'])):?>
							<?php echo str_replace('Min/Max ', '', $d['smarts']['Airflow_Temperature_Cel']['value'])?>
						<?php else:?>
							–
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['smarts']['Reallocated_Sector_Ct'])):?>
							<?php echo $d['smarts']['Reallocated_Sector_Ct']['value']?> <?php echo $d['smarts']['Reallocated_Sector_Ct']['whenFailed']?>
						<?php else:?>
							<i>–</i>
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['smarts']['Raw_Read_Error_Rate'])):?>
							<?php echo $d['smarts']['Raw_Read_Error_Rate']['value']?> <?php echo $d['smarts']['Raw_Read_Error_Rate']['whenFailed']?>
						<?php else:?>
							<i>–</i>
						<?php endif?>
					</td>
					<td>
						<?php if (!empty($d['smarts']['Seek_Error_Rate'])):?>
							<?php echo $d['smarts']['Seek_Error_Rate']['value']?> <?php echo $d['smarts']['Seek_Error_Rate']['whenFailed']?>
						<?php else:?>
							<i>–</i>
						<?php endif?>
					</td>
				</tr>
				<tr tabindex="-1">
					<td colspan="9" style="border-top: none;">
						<table>
							<tbody>
							<?php foreach ($d['info'] as $key=>$val):?>
								<tr>
									<td style="width: 30%;"><?php echo $key?></td>
									<td><?php echo $val?></td>
								</tr>
							<?php endforeach;?>
							</tbody>
						</table>
						<?php if (!empty($d['smarts']) && isset(next($d['smarts'])['id'])):?>
							<table>
								<thead>
								<tr style="background-color: white; font-weight: bold;">
									<?php foreach (array_keys(next($d['smarts'])) as $name):?>
										<td><?php echo $name?></td>
									<?php endforeach;?>
								</tr>
								</thead>
								<tbody>
								<?php foreach ($d['smarts'] as $params):?>
									<tr>
										<?php foreach ($params as $val):?>
											<td><?php echo $val?></td>
										<?php endforeach;?>
									</tr>
								<?php endforeach;?>
								</tbody>
							</table>
						<?php elseif(!empty($d['smarts'])):?>
							<table>
								<tbody>
								<?php foreach ($d['smarts'] as $key=>$val):?>
									<tr>
										<td style="width: 30%;"><?php echo $key?></td>
										<td><?php echo is_array($val) ? print_r($val, true) : $val?></td>
									</tr>
								<?php endforeach;?>
								</tbody>
							</table>
						<?php endif?>
					</td>
				</tr>
			<?php endforeach;?>
			</tbody>
		</table>
	<?php endif?>
</div>