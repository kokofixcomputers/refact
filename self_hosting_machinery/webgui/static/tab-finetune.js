let logstream_reader = null;
let logstream_runid = null;
let downloaded_data = null;
let blue_lora = "";
let loras_switch_off = null;
let loras_switch_latest = null;
let loras_switch_specific = null;
let loras_switch_no_reaction = false;
let finetune_settings_defaults = [];
let fine_filter_progress = null;
let fine_filter_pane = null;
let fine_filter_button = null;
let fine_filter_settings = null;
let fine_filter_status = null;
let fine_filter_error = null;

let fine_tuning_pane = null;
let fine_tuning_button = null;
// let checkpoint_name = "best";
// let selected_model = ""; // we don't have model choice, empty for now

function finetune_data() {
    fetch("/tab-finetune-config-and-runs")
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            console.log('tab-finetune-config-and-runs',data);
            render_finetune_settings(data);
            downloaded_data = data;
            render_lora_switch();
            render_runs();
        });
}

function render_model_select() {
    fetch("/tab-host-models-get")
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
      const model_selector = document.querySelector('#finetune-model');
      data.models.forEach(model => {
        if(model.has_finetune) {
            const new_option = new Option(model.name, model.name); 
            if(downloaded_data.config.model_name === model.name) {
                new_option.selected = true;
            }
            model_selector.appendChild(new_option);
        }
      });
    });
}

function change_model() {
    const model_selector = document.querySelector('#finetune-model');
    const model = model_selector.options[model_selector.selectedIndex].value;
    fetch(`/tab-finetune-model/${model}`)
    .then(response => {
        return response.json();
    })
    .then(data => {
        render_model_select();
        document.querySelector('#finetune-model').value = data.model_name;
    });
}

function render_finetune_settings(data = {}) {
    if (data.config.auto_delete_n_runs) {
        document.querySelector('.store-input').value = data.config.auto_delete_n_runs;
    }
    if (data.config.limit_training_time_minutes) {
        const radio_limit_time = document.querySelector(`input[name="limit_training_time_minutes"][value="${data.config.limit_training_time_minutes}"]`);
        if (radio_limit_time) {
            radio_limit_time.checked = true;
        }
    }
    if (data.config.run_at_night) {
        document.querySelector('#night_run').checked = true;
    }
    if (data.config.run_at_night_time) {
        const selectElement = document.querySelector('.night-time');
        const optionToSelect = selectElement.querySelector(`option[value="${data.config.run_at_night_time}"]`);
        if (optionToSelect) {
            optionToSelect.selected = true;
        }
    }
}

function delete_run(run_id) {
    fetch(`/tab-finetune-remove/${run_id}`)
    .then(response => {
        if (!response.ok) {
            return response.json()
        }
        const gfx = document.querySelector('.fine-gfx');
        gfx.src = `/tab-finetune-progress-svg/none`;
          const log_container = document.querySelector('.tab-upload-finetune-logs');
        if (log_container) {
            log_container.innerHTML = '';
        }
    })
    .then(error => {
        throw new Error(error.message);
    });
}

function render_runs() {
    let data = downloaded_data;
    let is_working = false;
    const start_finetune_button = document.querySelector('.tab-finetune-run-now');
    start_finetune_button.setAttribute("need_to_stop", is_working)
    // start_finetune_button.disabled = ![undefined, 'interrupted', 'finished', 'error'].includes(data.filtering_status)
    if(data.finetune_runs.length > 0) {
        document.querySelector('.run-table').innerHTML = '';
    }
    if(data.finetune_runs.length === 0) {
        return;
    }
    document.querySelector('.table-types').style.display = 'table';
    data.finetune_runs.forEach(element => {
        const row = document.createElement('tr');
        row.style.whiteSpace = 'nowrap';
        const run_name = document.createElement("td");
        const run_status = document.createElement("td");
        const run_minutes = document.createElement("td");
        const run_steps = document.createElement("td");
        const run_delete = document.createElement("td");

        run_name.innerText = element.run_id;
        let status_color;
        switch (element.status) {
            case 'unknown':
                status_color = `text-bg-warning`;
                break;
            case 'starting':
                status_color = `text-bg-secondary`;
                break;
            case 'working':
                status_color = `text-bg-secondary`;
                break;
            case 'completed':
            case 'finished':
                status_color = `text-bg-success`;
                break;
            case 'failed':
                status_color = `text-bg-danger`;
                break;
            default:
                status_color = `text-bg-info`;
                break;
        }

        row.dataset.run = element.run_id;
        const local_is_working = !(['interrupted', 'failed', 'finished'].includes(element.status));
        if (local_is_working) {
            is_working = true;
            if (!blue_lora) {
                blue_lora = element.run_id;
            }
            run_status.innerHTML = `<span class="badge rounded-pill ${status_color}"><div class="finetune-spinner spinner-border spinner-border-sm" role="status"></div>${element.status}</span>`;
        } else {
            run_status.innerHTML = `<span class="badge rounded-pill ${status_color}">${element.status}</span>`;
        }
        if (element.eta_minutes) {
            run_minutes.innerHTML = element.eta_minutes;
        }
        run_steps.innerHTML = element.worked_steps;
        const disabled = local_is_working ? "disabled" : ""
        run_delete.innerHTML = `<button class="btn btn-danger btn-sm" ${disabled}><i class="bi bi-trash3-fill"></i></button>`;
        row.appendChild(run_name);
        row.appendChild(run_status);
        row.appendChild(run_minutes);
        row.appendChild(run_steps);
        row.appendChild(run_delete);
        if (!local_is_working) {
            run_delete.addEventListener('click', () => {
                const lora_for_delete = row.dataset.run;
                let delete_lora_modal = document.getElementById('delete-lora-modal');
                let delete_lora_modal_button = delete_lora_modal.querySelector('.delete-lora-modal-submit');
                delete_lora_modal_button.dataset.lora = lora_for_delete;
                let delete_lora_modal_instance = bootstrap.Modal.getOrCreateInstance(delete_lora_modal);
                delete_lora_modal_instance.show();
            });
        }

        document.querySelector('.run-table').appendChild(row);
        if (blue_lora == element.run_id) {
            row.classList.add('table-success');
            const timestamp = new Date().getTime();
            const gfx = document.querySelector('.fine-gfx');
            gfx.src = `/tab-finetune-progress-svg/${element.run_id}?t=${timestamp}`;
            start_log_stream(element.run_id);
            const log_link = document.querySelector('.log-link');
            if(log_link && log_link.classList.contains('d-none')) {
                log_link.classList.remove('d-none');
            }
            if(log_link) {
                log_link.href = `/tab-finetune-log/${element.run_id}`;
            }
        }
    });
    const rows = document.querySelectorAll('.run-table tr');
    rows.forEach(function (row) {
        row.addEventListener('click', function (event) {
            event.stopPropagation();
            const run_id = this.dataset.run;
            blue_lora = run_id;
            render_runs();
            render_checkpoints(find_checkpoints_by_run(run_id));
        });
    });
    if(is_working) {
        start_finetune_button.innerHTML = '<div class="upload-spinner spinner-border spinner-border-sm" role="status"></div>' + 'Stop';
    } else {
        start_finetune_button.innerHTML = '<i class="bi bi-gpu-card"></i> Run Now';
    }
    start_finetune_button.setAttribute("need_to_stop", is_working)
    start_finetune_button.disabled = ![undefined, 'interrupted', 'finished', 'error'].includes(data.filtering_status)
}

const find_checkpoints_by_run = (run_id) => {
    const finetune_run = downloaded_data.finetune_runs.find((run) => run.run_id === run_id);
    if (finetune_run) {
      return finetune_run.checkpoints;
    } else {
      return null;
    }
};

function render_lora_switch() {
    let mode = downloaded_data.active ? downloaded_data.active.lora_mode : "latest-best";
    loras_switch_no_reaction = true; // avoid infinite loop when setting .checked
    if (mode === 'off') {
        loras_switch_off.checked = true;
    } else if (mode === 'latest-best') {
        loras_switch_latest.checked = true;
    } else if (mode === 'specific') {
        loras_switch_specific.checked = true
    }
    loras_switch_no_reaction = false;
    let lora_switch_run_id = document.querySelector('#lora-switch-run-id');
    let lora_switch_checkpoint = document.querySelector('#lora-switch-checkpoint');
    if (mode === 'specific') {
        lora_switch_run_id.style.display = 'block';
        lora_switch_checkpoint.style.display = 'block';
        lora_switch_run_id.style.opacity = 1;
        lora_switch_checkpoint.style.opacity = 1;
        lora_switch_run_id.innerHTML = `<b>Run:</b> ${downloaded_data.active.specific_lora_run_id}`;
        lora_switch_checkpoint.innerHTML = `<b>Checkpoint:</b> ${downloaded_data.active.specific_checkpoint}`;
    } else if (mode == 'latest-best') {
        lora_switch_run_id.style.display = 'block';
        lora_switch_checkpoint.style.display = 'block';
        lora_switch_run_id.style.opacity = 0.5;
        lora_switch_checkpoint.style.opacity = 0.5;
        lora_switch_run_id.innerHTML = `<b>Run:</b> ${downloaded_data.finetune_latest_best.latest_run_id}`;
        lora_switch_checkpoint.innerHTML = `<b>Checkpoint:</b> ${downloaded_data.finetune_latest_best.best_checkpoint_id}`;
    } else {
        lora_switch_run_id.style.display = 'none';
        lora_switch_checkpoint.style.display = 'none';
        lora_switch_run_id.innerHTML = `<b>Run:</b> ${downloaded_data.active.specific_lora_run_id}`;
        lora_switch_checkpoint.innerHTML = `<b>Checkpoint:</b> ${downloaded_data.active.specific_checkpoint}`;
    }
}

function render_checkpoints(data = []) {
    const checkpoints = document.querySelector('.table-checkpoints');
    checkpoints.innerHTML = '';
    if (data.length > 0) {
        data.forEach(element => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.textContent = `${element.checkpoint_name}`;
            cell.dataset.checkpoint = element.checkpoint_name;
            if(cell.dataset.checkpoint === downloaded_data.active.specific_checkpoint) {
                row.classList.add('table-success');
            }
            row.appendChild(cell);
            checkpoints.appendChild(row);
            row.addEventListener('click', (event) => {
                if(!row.classList.contains('table-success')) {
                    let prev = document.querySelector('.table-checkpoints .table-success');
                    if (prev) {
                        prev.classList.remove('table-success');
                    }
                    row.classList.add('table-success');
                }
                finetune_switch_activate("specific", blue_lora, cell.dataset.checkpoint);
            });
        });
    }
}

function loras_switch_clicked() {
    if (loras_switch_no_reaction)
        return;
    if (loras_switch_off.checked === true) {
        finetune_switch_activate("off");
    } else if (loras_switch_latest.checked === true) {
        finetune_switch_activate("latest-best");
    } else if (loras_switch_specific.checked === true) {
        finetune_switch_activate("specific");
    }
}

function finetune_switch_activate(lora_mode, run_id, checkpoint) {
    let send_this = {
        "model": "",
        "lora_mode": lora_mode,
        "specific_lora_run_id": run_id ? run_id : downloaded_data.active.specific_lora_run_id,
        "specific_checkpoint": checkpoint ? checkpoint : downloaded_data.active.specific_checkpoint,
    }
    console.log(send_this);
    fetch("/tab-finetune-activate", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(send_this)
    })
    .then(function (response) {
        finetune_data();
    });
}

function render_schedule_dialog() {
    const selectElement = document.querySelector('.night-time');
    for (let hour = 0; hour < 24; hour++) {
        const option = document.createElement("option");
        const formattedHour = hour.toString().padStart(2, "0");

        option.value = formattedHour + ":00";
        option.text = formattedHour + ":00";
        selectElement.appendChild(option);
    }
}
const finetune_inputs = document.querySelectorAll('.fine-tune-input');
for (let i = 0; i < finetune_inputs.length; i++) {
    finetune_inputs[i].addEventListener('change', function () {
        save_finetune_schedule();
    });
}
function save_finetune_schedule() {
    const data = {
        "limit_training_time_minutes": document.querySelector('input[name="limit_training_time_minutes"]:checked').value,
        "run_at_night": document.querySelector('#night_run').checked,
        "run_at_night_time": document.querySelector('.night-time').value,
        "auto_delete_n_runs": document.querySelector('.store-input').value,
    }
    console.log('save_finetune_settings', data);
    fetch("/tab-finetune-config-save", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(function (response) {
        console.log(response);
        finetune_data();
    });
}

function start_log_stream(run_id) {
    if (run_id === logstream_runid) {
        return;
    }

    const log_div = document.querySelector('.tab-upload-finetune-logs');
    log_div.textContent = '';

    const streamTextFile = async () => {
        const decoder = new TextDecoder();
        const response = await fetch(`/tab-finetune-log/${run_id}`);
        const reader = response.body.getReader();

        if (logstream_reader) {
            logstream_reader.cancel();
        }
        logstream_reader = reader;
        logstream_runid = run_id;

        const processResult = ({ done, value }) => {
            if (done) {
                console.log('Streaming complete');
                return;
            }

            const chunk = decoder.decode(value);


            const isAtBottom = log_div.scrollTop >= (log_div.scrollHeight - log_div.offsetHeight);

            log_div.textContent += chunk;

            if (isAtBottom) {
                log_div.scrollTop = log_div.scrollHeight;
            }
            const timestamp = new Date().getTime();
            const gfx = document.querySelector('.fine-gfx');
            gfx.src = `/tab-finetune-progress-svg/${run_id}?t=${timestamp}`;
            return reader.read().then(processResult);
        };

        return reader.read().then(processResult);
    };

    streamTextFile()
        .catch(error => {
            console.log('Error:', error);
        });
}


function get_finetune_settings(defaults = false) {
    fetch("/tab-finetune-training-get")
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        console.log('tab-finetune-training-get',data);
        let settings_data = null;
        finetune_settings_defaults = data.defaults;
        console.log('finetune_settings_defaults', finetune_settings_defaults);
        if(Object.keys(data.user_config).length > 0 && !defaults) {
            settings_data = data.user_config;
        } else {
            settings_data = data.defaults;
        }
        console.log(settings_data);
        document.querySelector('#finetune-tab-settings-modal #limit_time_seconds').value = settings_data.limit_time_seconds;
        document.querySelector('#finetune-tab-settings-modal #lr').value = settings_data.lr;
        document.querySelector('#finetune-tab-settings-modal #batch_size').value = settings_data.batch_size;
        document.querySelector('#finetune-tab-settings-modal #warmup_num_steps').value = settings_data.warmup_num_steps;
        document.querySelector('#finetune-tab-settings-modal #weight_decay').value = settings_data.weight_decay;
        document.querySelector('#finetune-tab-settings-modal #train_steps').value = settings_data.train_steps;
        document.querySelector('#finetune-tab-settings-modal #lr_decay_steps').value = settings_data.lr_decay_steps;
        document.querySelector('#finetune-tab-settings-modal #lora_r').value = settings_data.lora_r;
        document.querySelector('#finetune-tab-settings-modal #lora_alpha').value = settings_data.lora_alpha;
        document.querySelector('#finetune-tab-settings-modal #lora_init_scale').value = settings_data.lora_init_scale;
        document.querySelector('#finetune-tab-settings-modal #lora_dropout').value = settings_data.lora_dropout;
        const low_gpu_mem_mode = settings_data.low_gpu_mem_mode;
        if(low_gpu_mem_mode) {
            document.querySelector('#finetune-tab-settings-modal #low_gpu_mem_mode_finetune').checked = true;
        } else {
            document.querySelector('#finetune-tab-settings-modal #low_gpu_mem_mode_finetune').checked = false;
        }
        const use_heuristics = settings_data.use_heuristics;
        if(use_heuristics) {
            document.querySelector('#finetune-tab-settings-modal #use_heuristics').checked = true;
        } else {
            document.querySelector('#finetune-tab-settings-modal #use_heuristics').checked = false;
        }
        check_heuristics();
    });
}

function save_finetune_settings() {
    console.log('save_finetune_settings');
    let low_gpu = false;
    if (document.querySelector('#finetune-tab-settings-modal #low_gpu_mem_mode_finetune').checked) {
        low_gpu = true;
    }
    let use_heuristics = false;
    if (document.querySelector('#finetune-tab-settings-modal #use_heuristics').checked) {
        use_heuristics = true;
    }
    fetch("/tab-finetune-training-setup", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            limit_time_seconds: document.querySelector('#finetune-tab-settings-modal #limit_time_seconds').value,
            lr: document.querySelector('#finetune-tab-settings-modal #lr').value,
            batch_size: document.querySelector('#finetune-tab-settings-modal #batch_size').value,
            warmup_num_steps: document.querySelector('#finetune-tab-settings-modal #warmup_num_steps').value,
            weight_decay: document.querySelector('#finetune-tab-settings-modal #weight_decay').value,
            use_heuristics: use_heuristics,
            train_steps: document.querySelector('#finetune-tab-settings-modal #train_steps').value,
            lr_decay_steps: document.querySelector('#finetune-tab-settings-modal #lr_decay_steps').value,
            lora_r: document.querySelector('#finetune-tab-settings-modal #lora_r').value,
            lora_alpha: document.querySelector('#finetune-tab-settings-modal #lora_alpha').value,
            lora_init_scale: document.querySelector('#finetune-tab-settings-modal #lora_init_scale').value,
            lora_dropout: document.querySelector('#finetune-tab-settings-modal #lora_dropout').value,
            low_gpu_mem_mode: low_gpu
        })
    })
    .then(function(response) {
        if(!response.ok) {
            return response.json();
        }
        const finetune_settings_error = document.querySelector('.finetune-settings-error');
        finetune_settings_error.textContent = '';
        finetune_settings_error.classList.add('d-none');
        get_finetune_settings();
        let url_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('finetune-tab-settings-modal'));
        url_modal.hide();
        
    })
    .catch(error_data => {
        const finetune_settings_error = document.querySelector('.finetune-settings-error');
        let error_text = '';
        
        error_data.detail.forEach((error) => {
            const field_name = error.loc[1];
            const error_message = error.msg;
            const field_text = `${field_name}: ${error_message}`;
            error_text += field_text + '<br>';
        });
        
        finetune_settings_error.innerHTML = error_text;
        finetune_settings_error.classList.remove('d-none');
    });
}

function check_heuristics() {
    const finetune_use_heuristics = document.querySelector('#use_heuristics');
    if(!finetune_use_heuristics.checked) {
        document.querySelector('.finetune-settings-optional').classList.remove('finetune-settings-optional-disabled');
        document.querySelectorAll('.finetune-settings-optional input').forEach(element => {
            element.removeAttribute('tabindex');
        });
    } else {
        document.querySelector('.finetune-settings-optional').classList.add('finetune-settings-optional-disabled');
        document.querySelectorAll('.finetune-settings-optional input').forEach(element => {
            element.setAttribute('tabindex', '-1');
        });
    }
}

function revert_to_default(input_id) {
    const input = document.getElementById(input_id);
    input.value = finetune_settings_defaults[input_id];
}

function run_stop_filtering() {
    // fine_filter_button = document.querySelector('.sources-run-button');
    const status = fine_filter_button.getAttribute("ftf_status")
    console.log('----------------------------------------------', status);
    fine_filter_button.disabled = true;
    switch (status) {
        case 'undefined':
        case 'interrupted':
        case 'failed':
        case 'error':
        case 'finished':
            do_starting_state();
            run_now();
            break;
        case 'starting':
        default:
            stop_filtering();
    }
}

function run_now() {
    fetch("/tab-finetune-run-now?filter_only=1")
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        console.log('run_now');
    });
}

function stop_filtering() {
    fetch("/tab-finetune-stop-now")
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        // console.log(data);
    });
}

function render_ftf_stats(data) {
    const ftf_wrapper = document.querySelector('.ftf-stats');
    if(Object.keys(data).length > 0 && data.accepted !== undefined && data.rejected !== undefined) {
        ftf_wrapper.innerHTML = '';
        const content = `<h6>GPU Filtering stats</h6><div>Accepted: ${data.accepted} <a target="_blank" href="/tab-files-log?phase=finetune_filter&accepted_or_rejected=accepted">Full list</a></div><div>Rejected: ${data.rejected} <a target="_blank" href="/tab-files-log?phase=finetune_filter&accepted_or_rejected=rejected">Full list</a></div>`;
        ftf_wrapper.innerHTML = content;
    }
}

function get_filters_settings(defaults = false) {
    fetch("/tab-finetune-smart-filter-get")
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        console.log('tab-finetune-smart-filter-get',data);
        let settings_data = null;
        if(Object.keys(data.user_config).length > 0 && !defaults) {
            settings_data = data.user_config;
        } else {
            settings_data = data.defaults;
        }
        document.querySelector('#upload-tab-source-settings-modal #filter_loss_threshold').value = settings_data.filter_loss_threshold;
    });
}

function render_filter_progress(progress_value) {
    fine_filter_progress.style.width = progress_value + "%";
}
function render_ftf_progress(filtering_progress) {
    const ftf_bar = document.querySelector('.ftf-bar');
    ftf_bar.style.width = filtering_progress + "%";
}

function reset_ftf_progress() {
    const eta_state = document.querySelector('.ftf-eta');
    eta_state.innerHTML = '';
    const progress_container = document.querySelector('.ftf-progress');
    progress_container.classList.add('d-none');
    const ftf_bar = document.querySelector('.ftf-bar');
    ftf_bar.style.width = "0%";
}

function do_starting_state() {
    fine_filter_button.disabled = true;
    fine_filter_pane.classList.add('pane-disabled');
    fine_tuning_button.disabled = true;
    fine_tuning_pane.classList.add('pane-disabled');
    if(!document.querySelector('.sources-run-button .spinner-border')) {
        fine_filter_button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></i>Starting`;
        fine_filter_status.innerHTML = 'starting';
    }
}

function save_filters_settings() {
    fetch("/tab-finetune-smart-filter-setup", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filter_loss_threshold: document.querySelector('#upload-tab-source-settings-modal #filter_loss_threshold').value,
        })
    })
    .then(function(response) {
        if(response.ok) {
            get_filters_settings();
        }
    });
}

// TODO: reset_ftf_progress() if sources deleted
function get_tab_files() {
    fetch("/tab-files-get")
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            console.log('tab-files-get',data);
            // tab_files_data = data;
            if(data.scan_error && data.scan_error.length > 0) {
                let scan_toast = document.querySelector('.upload-tab-scan-error-toast');
                const scan_error_toast = bootstrap.Toast.getOrCreateInstance(scan_toast);
                if(!show_scan_error) {
                    document.querySelector('.upload-tab-scan-error-toast .toast-body').innerHTML = data.scan_error;
                    scan_error_toast.show()
                    show_scan_error = true;
                }
            }
            if(data.scan_status === 'completed') {
                fine_filter_button.disabled = false;
                fine_filter_pane.classList.remove('pane-disabled');
            } else {
                fine_filter_pane.classList.add('pane-disabled');
                fine_filter_button.disabled = true;
            }
            render_ftf_stats(data.filestats_ftf);
            // console.log('data.filestats_ftf',data.filestats_ftf);
            if(data.scan_finished) {
                fine_filter_pane.classList.remove('pane-disabled');
                if(data.filestats_ftf.status) {
                    document.querySelector('.ftf-status').classList.remove('d-none');
                    document.querySelector('.start-funetune-stats').classList.remove('d-none');
                } else {
                    document.querySelector('.ftf-status').classList.add('d-none');
                    document.querySelector('.start-funetune-stats').classList.add('d-none');
                }
                fine_filter_button.disabled = false;
                const status = data.filestats_ftf.status;
                fine_filter_button.setAttribute("ftf_status", status)
                if(!data.filestats_ftf.error || data.filestats_ftf.error === '') {
                    if(fine_filter_error && !fine_filter_error.classList.contains('d-none')) {
                        fine_filter_error.classList.add('d-none');
                    }
                    fine_filter_error.querySelector('span').innerHTML = '';
                }
                if(data.filestats_ftf.eta_minutes && data.filestats_ftf.eta_minutes !== 0) {
                    const eta_state = document.querySelector('.ftf-eta');
                    eta_state.innerHTML = 'ETA: ' + data.filestats_ftf.eta_minutes + ' minute(s)';

                    const progress_container = document.querySelector('.ftf-progress');
                    progress_container.classList.remove('d-none');
                    render_ftf_progress(data.filtering_progress);

                }
                fine_filter_settings.disabled = false
                switch(status) {
                    case undefined:
                    case 'interrupted':
                    case 'finished':
                        fine_filter_button.disabled = false;
                        let status_line = "";
                        if (status !== undefined) {
                            status_line = status;
                        }
                        fine_filter_status.innerHTML = status_line;
                        fine_filter_button.innerHTML = `<i class="bi bi-funnel-fill"></i> Run filter`;
                        // sources_pane.classList.remove('pane-disabled');
                        fine_filter_settings.disabled = false;
                        reset_ftf_progress();
                        break;
                    case 'starting':
                        do_starting_state()
                        break;
                    case 'error':
                        fine_filter_button.disabled = true;
                        fine_filter_status.innerHTML = status;
                        fine_filter_settings.disabled = false;
                        reset_ftf_progress();
                        if(data.filestats_ftf.error && data.filestats_ftf.error !== '') {
                            if(fine_filter_error && fine_filter_error.classList.contains('d-none')) {
                                fine_filter_error.classList.remove('d-none');
                            }
                            fine_filter_error.querySelector('span').innerHTML = data.filestats_ftf.error;
                        }
                        break;
                    case 'failed':
                        fine_filter_status.innerHTML = status;
                        fine_filter_settings.disabled = false;
                        reset_ftf_progress();
                        if(data.filestats_ftf.error && data.filestats_ftf.error !== '') {
                            if(fine_filter_error && fine_filter_error.classList.contains('d-none')) {
                                fine_filter_error.classList.remove('d-none');
                            }
                            fine_filter_error.querySelector('span').innerHTML = data.filestats_ftf.error;
                        }
                        break;
                    default:
                        fine_filter_button.disabled = false;
                        fine_filter_button.innerHTML = `Stop filter`;
                        if(!document.querySelector('.sources-run-button .spinner-border')) {
                            fine_filter_button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></i>Stop filter`;
                            fine_filter_status.innerHTML = data.filestats_ftf.status;
                        }
                        fine_filter_pane.classList.remove('pane-disabled');
                        fine_filter_settings.disabled = true
                        break;
                }
            }
            else {
                document.querySelector('.ftf-status').classList.add('d-none');
                document.querySelector('.start-funetune-stats').classList.add('d-none');
            }
            if (data.finetune_working_now) {
                fine_filter_pane.classList.add('pane-disabled');
                fine_filter_settings.disabled = true;
            }
        });
}

export async function init() {
    let req = await fetch('/tab-finetune.html');
    document.querySelector('#finetune').innerHTML = await req.text();
    fine_filter_pane = document.querySelector('.start-funetune-step1');
    fine_filter_pane.classList.add('pane-disabled');
    fine_tuning_pane = document.querySelector('.start-funetune-step2');
    fine_tuning_pane.classList.add('pane-disabled');
    fine_filter_progress = document.querySelector('.start-funetune-stats .progress-bar');
    fine_filter_settings = document.querySelector('.sources-settings');
    fine_filter_status = document.querySelector('.ftf-status span');
    fine_filter_error = document.querySelector('.ftf-error');
    fine_filter_button = document.querySelector('.sources-run-button');
    fine_filter_button.disabled = true;
    fine_tuning_button = document.querySelector('.tab-finetune-run-now');
    fine_tuning_button.disabled = true;

    const log_container = document.querySelector('.log-container');
    function handle_auto_scroll() {
        if (log_container.scrollHeight - log_container.scrollTop === log_container.clientHeight) {
            log_container.scrollTop = log_container.scrollHeight;
        }
    }
    log_container.addEventListener('scroll', handle_auto_scroll);
    const start_finetune_button = document.querySelector('.tab-finetune-run-now');
    start_finetune_button.addEventListener('click', function () {
        let url = "/tab-finetune-run-now";
        start_finetune_button.disabled = true;
        start_finetune_button.innerHTML = `<div class="upload-spinner spinner-border spinner-border-sm" role="status"></div>Starting...`;
        if (start_finetune_button.getAttribute("need_to_stop") === 'true') {
            url = "/tab-finetune-stop-now";
        }
        fetch(url)
            .then(function (response) {
                finetune_data();
            })
    });
    const loras = document.querySelectorAll('.lora-switch');
    loras.forEach(element => {
        if (element.value === 'off')
            loras_switch_off = element;
        if (element.value === 'latest')
            loras_switch_latest = element;
        if (element.value === 'specific')
            loras_switch_specific = element;
    });
    loras_switch_off.addEventListener('change', loras_switch_clicked);
    loras_switch_latest.addEventListener('change', loras_switch_clicked);
    loras_switch_specific.addEventListener('change', loras_switch_clicked);
    const loras_table = document.querySelector('.run-table-wrapper');
    loras_table.scrollTop = loras_table.scrollHeight;

    const finetune_modal = document.getElementById('finetune-tab-settings-modal');
    finetune_modal.addEventListener('show.bs.modal', function () {
        get_finetune_settings();
    });

    const finetune_submit = document.querySelector('.finetune-tab-settings-submit');
    finetune_submit.addEventListener('click', function() {
        save_finetune_settings();
    });

    const finetune_modal_defaults = document.querySelector('.finetune-tab-settings-default');
    finetune_modal_defaults.addEventListener('click', function() {
        get_finetune_settings(true);
    });
    let delete_lora_modal_button = document.querySelector('.delete-lora-modal-submit');
    delete_lora_modal_button.addEventListener('click', () => {
        const lora_for_delete = delete_lora_modal_button.dataset.lora;
        delete_run(lora_for_delete);
        let delete_lora_modal = document.getElementById('delete-lora-modal');
        let delete_lora_modal_instance = bootstrap.Modal.getOrCreateInstance(delete_lora_modal);
        delete_lora_modal_instance.hide();
    });

    check_heuristics();
    const finetune_use_heuristics = document.querySelector('#use_heuristics');
    finetune_use_heuristics.addEventListener('change', function(event) {
        check_heuristics();
    });

    const finetune_default_buttons = document.querySelectorAll('.form-clear-default');
    finetune_default_buttons.forEach(element => {
        element.addEventListener('click', function(event) {
            revert_to_default(event.target.parentNode.previousElementSibling.id);
        });
    });

    fine_filter_button = document.querySelector('.sources-run-button');
    fine_filter_button.addEventListener('click', run_stop_filtering);

    const settings_modal = document.getElementById('upload-tab-source-settings-modal');
    settings_modal.addEventListener('show.bs.modal', function () {
        get_filters_settings();
    });

    const settings_modal_submit = document.querySelector('.tab-upload-source-settings-submit');
    settings_modal_submit.addEventListener('click', function() {
        save_filters_settings();
        const settings_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('upload-tab-source-settings-modal'));
        settings_modal.hide();
    });

    const settings_modal_defaults = document.querySelector('.tab-upload-source-settings-default');
    settings_modal_defaults.addEventListener('click', function() {
        get_filters_settings(true);
    });

    // const scan_error_toast = document.querySelector('.upload-tab-scan-error-toast');
    // scan_error_toast.addEventListener('hidden.bs.toast', () => {
    //     show_scan_error = false;
    // })
}

export function tab_switched_here() {
    finetune_data();
    get_tab_files();
    render_schedule_dialog();
    render_model_select();
}

export function tab_switched_away() {
}

export function tab_update_each_couple_of_seconds() {
    get_tab_files();
    finetune_data();
}
