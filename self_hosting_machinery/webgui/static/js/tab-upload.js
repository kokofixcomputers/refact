let tab_files_data = null;
let show_scan_error = false;
let sort_type = 'filetype';
let sort_order = 'asc';
let sort_started = false;
let dont_disable_file_types = false;


function do_starting_state() {
    sources_run_button.disabled = true;
    sources_run_pane.classList.add('pane-disabled');
    filetypes_pane.classList.add('pane-disabled');
    sources_pane.classList.add('pane-disabled');
    if(!document.querySelector('.sources-run-button .spinner-border')) {
        sources_run_button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></i>Starting`;
        sources_status.innerHTML = 'starting';
    }
}

function get_tab_files() {
    fetch("/tab-files-get")
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            // console.log('tab-files-get',data);
            tab_files_data = data;
            if(data.scan_error && data.scan_error.length > 0) {
                let scan_toast = document.querySelector('.upload-tab-scan-error-toast');
                const scan_error_toast = bootstrap.Toast.getOrCreateInstance(scan_toast);
                if(!show_scan_error) {
                    document.querySelector('.upload-tab-scan-error-toast .toast-body').innerHTML = data.scan_error;
                    scan_error_toast.show()
                    show_scan_error = true;
                }
            }
            // render_filter_progress(data.filtering_progress);
            if(dont_disable_file_types || data.scan_status && data.scan_status === 'completed') {
                document.querySelector('.filetypes-pane').classList.remove('pane-disabled');
                document.querySelector('.run-pane').classList.remove('pane-disabled');
            } else {
                document.querySelector('.filetypes-pane').classList.add('pane-disabled');
                document.querySelector('.run-pane').classList.add('pane-disabled');
            }
            render_tab_files(data);
            render_filetypes(data.mime_types, data.filetypes);
            render_force_filetypes(data.filetypes);
            render_ftf_stats(data.filestats_ftf);
            if(data.filestats_ftf) {
                if(data.filestats_ftf.status) {
                    document.querySelector('.ftf-status').classList.remove('d-none');
                } else {
                    document.querySelector('.ftf-status').classList.add('d-none');
                }
                sources_run_button.disabled = false;
                const status = data.filestats_ftf.status;
                sources_run_button.setAttribute("ftf_status", status)
                if(!data.filestats_ftf.error || data.filestats_ftf.error === '') {
                    if(sources_error && !sources_error.classList.contains('d-none')) {
                        sources_error.classList.add('d-none');
                    }
                    sources_error.querySelector('span').innerHTML = '';
                }
                if(data.filestats_ftf.eta_minutes && data.filestats_ftf.eta_minutes !== 0) {
                    const eta_state = document.querySelector('.ftf-eta');
                    eta_state.innerHTML = 'ETA: ' + data.filestats_ftf.eta_minutes + ' minute(s)';

                    const progress_container = document.querySelector('.ftf-progress');
                    progress_container.classList.remove('d-none');
                    render_ftf_progress(data.filtering_progress);
                }
                sources_settings.disabled = false
                switch(status) {
                    case undefined:
                    case 'interrupted':
                    case 'finished':
                        sources_run_button.disabled = false;
                        let status_line = "";
                        if (status !== undefined) {
                            status_line = status;
                        }
                        sources_status.innerHTML = status_line;
                        sources_run_button.innerHTML = `<i class="bi bi-gpu-card"></i>Run filter`;
                        sources_pane.classList.remove('pane-disabled');
                        sources_settings.disabled = false;
                        reset_ftf_progress();
                        break;
                    case 'starting':
                        do_starting_state()
                        break;
                    case 'error':
                        sources_run_button.disabled = true;
                        sources_status.innerHTML = status;
                        sources_settings.disabled = false;
                        reset_ftf_progress();
                        if(data.filestats_ftf.error && data.filestats_ftf.error !== '') {
                            if(sources_error && sources_error.classList.contains('d-none')) {
                                sources_error.classList.remove('d-none');
                            }
                            sources_error.querySelector('span').innerHTML = data.filestats_ftf.error;
                        }
                        break;
                    case 'failed':
                        sources_status.innerHTML = status;
                        sources_settings.disabled = false;
                        reset_ftf_progress();
                        if(data.filestats_ftf.error && data.filestats_ftf.error !== '') {
                            if(sources_error && sources_error.classList.contains('d-none')) {
                                sources_error.classList.remove('d-none');
                            }
                            sources_error.querySelector('span').innerHTML = data.filestats_ftf.error;
                        }
                        break;
                    default:
                        sources_run_button.disabled = false;
                        sources_run_button.innerHTML = `Stop filter`;
                        if(!document.querySelector('.sources-run-button .spinner-border')) {
                            sources_run_button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></i>Stop filter`;
                            sources_status.innerHTML = data.filestats_ftf.status;
                        }
                        sources_pane.classList.add('pane-disabled');
                        filetypes_pane.classList.add('pane-disabled');
                        sources_run_pane.classList.remove('pane-disabled');
                        sources_settings.disabled = true
                        break;
                }
            }
            if (data.finetune_working_now) {
                sources_pane.classList.add('pane-disabled');
                filetypes_pane.classList.add('pane-disabled');
                sources_run_pane.classList.add('pane-disabled');
                sources_settings.disabled = true;
            }
        });
}

const progress_bar = document.querySelector('.sources-run-progress .progress-bar');
const sources_pane = document.querySelector('.sources-pane');
const filetypes_pane = document.querySelector('.filetypes-pane');
const sources_run_pane = document.querySelector('.run-pane');
const sources_run_button = document.querySelector('.sources-run-button');
const sources_settings = document.querySelector('.sources-settings');
const sources_status = document.querySelector('.ftf-status span');
const sources_error = document.querySelector('.ftf-error');

function render_filter_progress(progress_value) {
    progress_bar.style.width = progress_value + "%";
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

function render_tab_files(data) {
    const files = document.getElementById("upload-tab-table-body-files");
    files.innerHTML = "";
    let i = 0;
    for(let item in data.uploaded_files) {
        const row = document.createElement('tr');
        row.setAttribute('data-file', item);
        row.style.whiteSpace = 'nowrap';
        const name = document.createElement("td");
        const is_git = document.createElement("td");
        const status = document.createElement("td");
        const set = document.createElement("td");
        const delete_file = document.createElement("td");
        name.innerHTML = item;

        const which_set = data.uploaded_files[item].which_set;
        if(which_set === "train") {
            // TODO XXX : lora-input?
            set.innerHTML = `<div class="btn-group" role="group" aria-label="basic radio toggle button group"><input type="radio" class="file-radio btn-check" name="file-which[${i}]" id="file-radio-auto${i}" value="train" autocomplete="off" checked><label for="file-radio-auto${i}" class="btn btn-outline-primary">Auto</label><input type="radio" class="lora-input btn-check" name="file-which[${i}]" value="test" id="file-radio-test${i}" autocomplete="off"><label for="file-radio-test${i}" class="btn btn-outline-primary">Test set</label></div>`
        }
        if(which_set === "test") {
            set.innerHTML = `<div class="btn-group" role="group" aria-label="basic radio toggle button group"><input type="radio" class="file-radio btn-check" name="file-which[${i}]" id="file-radio-auto${i}" value="train" autocomplete="off"><label for="file-radio-auto${i}" class="btn btn-outline-primary">Auto</label><input type="radio" class="lora-input btn-check" name="file-which[${i}]" value="test" id="file-radio-test${i}" autocomplete="off" checked><label for="file-radio-test${i}" class="btn btn-outline-primary">Test set</label></div>`
        }
        delete_file.innerHTML = `<button type="button" data-file="${item}" class="btn btn-danger file-remove"><i class="bi bi-trash3-fill"></i></button>`;
        row.appendChild(name);
        row.appendChild(is_git);
        row.appendChild(status);
        row.appendChild(set);
        row.appendChild(delete_file);
        files.appendChild(row);
        i++;
    }

    change_events();
    delete_events();

    let any_working = false;
    for (const [item,item_object] of Object.entries(data.uploaded_files)) {
        const rows = files.querySelectorAll('tr');
        for (const row of rows) {
            const row_file_name = row.getAttribute('data-file');
            if (row_file_name === item) {
                const is_git_cell = row.querySelector('td:nth-child(2)');

                if (item_object.is_git) {
                    is_git_cell.innerHTML = `<span class="badge rounded-pill text-bg-warning">git</span>`;
                } else {
                    is_git_cell.innerHTML = `<span class="badge rounded-pill text-bg-info">file</span>`;
                }

                const target_cell = row.querySelector('td:nth-child(3)');
                let current_status = item_object.status;
                if (!current_status) {
                    current_status = "";
                }
                const status_color = file_status_color(current_status);
                let info_data = `<div><b>Status:</b> ${item_object.status}</div>`;
                if(item_object.files) {
                    info_data += `<div><b>Files:</b> ${item_object.files}</div>`;
                }
                if(item_object.generated) {
                    info_data += `<div><b>Generated:</b> ${item_object.generated}</div>`;
                }
                if(item_object.good) {
                    info_data += `<div><b>Good:</b> ${item_object.good}</div>`;
                }
                if(item_object.large) {
                    info_data += `<div><b>Too Large:</b> ${item_object.large}</div>`;
                }
                if(item_object.vendored) {
                    info_data += `<div><b>Vendored:</b> ${item_object.vendored}</div>`;
                }
                if(current_status === 'completed') {
                    // target_cell.innerHTML = `<span>Files: ${item_object.files} / Good: ${item_object.good}</span><i class="source-info bi bi-info-square-fill text-success"></i><div class="source-popup">${info_data}</div>`;
                    target_cell.innerHTML = `<span>${item_object.files} files</span><i class="source-info bi bi-info-square-fill text-success"></i><div class="source-popup">${info_data}</div>`;
                    row.querySelector('.source-info').addEventListener('mouseover', function(event) {
                        event.target.nextElementSibling.style.display = 'block';
                        // null on reading style
                    });
                    row.querySelector('.source-info').addEventListener('mouseout', function(event) {
                        // null on reading s
                        event.target.nextElementSibling.style.display = 'none';
                    });
                } else if (current_status === 'failed') {
                    target_cell.innerHTML = `<span class="file-status badge rounded-pill ${status_color}">${current_status}</span><div class="source-popup"><pre>${item_object.message}</pre></div>`;
                    row.querySelector('.file-status').addEventListener('mouseover', function(event) {
                        event.target.nextElementSibling.style.display = 'block';
                        // null on reading style
                    });
                    row.querySelector('.file-status').addEventListener('mouseout', function(event) {
                        // null on reading s
                        event.target.nextElementSibling.style.display = 'none';
                    });
                } else {
                    target_cell.innerHTML = `<span class="file-status badge rounded-pill ${status_color}">${current_status}`;
                }
                if (current_status == "working" || current_status == "starting") {
                    any_working = true;
                }
                break;
            }
        }
    }

    const process_button = document.querySelector('.tab-files-process-now');
    if (any_working) {
        let process_button_text = "Scanning...";
        process_button.innerHTML = '<div class="upload-spinner spinner-border spinner-border-sm" role="status"></div>' + process_button_text;
    } else {
        if (process_button.dataset.loading) {
            process_button.dataset.loading = false;
            process_button.disabled = false;
        }
        process_button.innerHTML = "Scan sources";
    }
}

function run_stop_filtering() {
    const status = sources_run_button.getAttribute("ftf_status")
    sources_run_button.disabled = true;
    switch (status) {
        case 'undefined':
        case 'interrupted':
        case 'failed':
        case 'error':
        case 'finished':
            do_starting_state()
            run_now();
            break;
        case 'starting':
        default:
            stop_filtering();
    }
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

function get_ssh_keys() {
    fetch("/tab-settings-get-all-ssh-keys")
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            console.log('get-all-ssh-keys',data);
        });
}

function delete_events() {
    document.querySelectorAll('#upload-tab-table-body-files .file-remove').forEach(function(element) {
        removeEventListener('click',element);
        element.addEventListener('click', function() {
            const file_name = this.getAttribute('data-file');
            let delete_modal = document.getElementById('delete-modal');
            let delete_modal_button = delete_modal.querySelector('.delete-modal-submit');
            delete_modal_button.dataset.file = file_name;
            let delete_modal_instance = bootstrap.Modal.getOrCreateInstance(delete_modal);
            delete_modal_instance.show();
        });
    });
}

let force_include_exclude_is_changed = false;
function render_force_filetypes(data) {
    if(force_include_exclude_is_changed) { return; }
    const force_include = document.querySelector('#force_include');
    const force_exclude = document.querySelector('#force_exclude');

    let force_include_val = data.force_include;
    if (force_include_val === undefined) {
        force_include_val = ""
    }
    force_include.value = force_include_val;
    let force_exclude_val = data.force_exclude;
    if (force_exclude_val === undefined) {
        force_exclude_val = ""
    }
    force_exclude.value = force_exclude_val;
}


function render_filetypes(mimetypes, filetypes) {
    if(mimetypes && mimetypes.length > 0) {
        const table_body = document.querySelector('.upload-tab-table-type-body');
        table_body.innerHTML = '';
        let i = 0;
        const sorted_mime_types = sort_filetypes(mimetypes);
        sorted_mime_types.forEach((item) => {
            const row = document.createElement('tr');
            let checkbox_checked = `checked`;
            let file_name = `<label for="file-list${i}" style="font-weight: bold">${item.file_type}</label>`;
            if (!item.trusted_language) {
                file_name = `<label for="file-list${i}" title="This file type may not yield optimal results for fine-tuning">${item.file_type}</label>`;
            }
            if (item.suitable_to_train) {
                row.classList.add('enabled-file');
            } else {
                row.classList.add('opacity-50');
                row.classList.add('disbled');
                checkbox_checked = `disabled`;
            }
            if (filetypes && filetypes["filetypes_finetune"][item.file_type] === false) {
                checkbox_checked = `unchecked`;
            }
            let file_checkbox = `<input id="file-list${i}" data-name="${item.file_type}" class="form-check-input" type="checkbox" value="${item.count}" ${checkbox_checked}>`;
            row.innerHTML = `<td>${file_checkbox}</td><td>${file_name}</td><td>${item.count}</td>`;
            table_body.appendChild(row);
            i++;
        });
        render_stats();
        watch_filetypes();
    }
}

function sort_filetypes(sorted_data) {
    if(!sort_started) { return sorted_data; }
    if(sort_type === 'filetype') {
        if (sort_order === 'asc') {
            sorted_data.sort((a, b) => a.file_type.localeCompare(b.file_type));
        } else {
            sorted_data.sort((a, b) => b.file_type.localeCompare(a.file_type));
        }
    }
    if(sort_type === 'count') {
        if (sort_order === 'asc') {
            sorted_data.sort(function (a, b) {
                return a.count - b.count;
            });
        } else {
            sorted_data.sort(function (a, b) {
                return b.count - a.count;
            });
        }
    }
    return sorted_data;
  }


function watch_filetypes() {
    const file_types = document.querySelectorAll('.upload-tab-table-type-body input');
    if(file_types.length > 0) {
        file_types.forEach(function(element) {
            element.addEventListener('change', function() {
                dont_disable_file_types = true;
                save_filter_setup();
            });
        });
    }
}

function render_stats() {
    const stats_finetune = document.querySelector('.sources-stats-finetune');
    // const stats_db = document.querySelector('.sources-stats-db');
    if (tab_files_data.filestats_scan_finetune && typeof tab_files_data.filestats_scan_finetune === 'object') {
        if(Object.keys(tab_files_data.filestats_scan_finetune).length > 0) {
            stats_finetune.style.display = 'flex';
            stats_finetune.style.whiteSpace = 'nowrap';
            const fine_accepted = document.querySelector('.sources-stats-fine-accepted span');
            fine_accepted.innerHTML = `${tab_files_data.filestats_scan_finetune.accepted} <a target="_blank" class="sources-stats-fine-accepted" href="/tab-files-log?phase=scan&accepted_or_rejected=accepted">Full List</a>`;
            const fine_rejected = document.querySelector('.sources-stats-fine-rejected span');
            fine_rejected.innerHTML = `${tab_files_data.filestats_scan_finetune.rejected} <a target="_blank" class="sources-stats-fine-rejected" href="/tab-files-log?phase=scan&accepted_or_rejected=rejected">Full List</a>`;
        }
    }
    // if (tab_files_data.filestats_scan_db && typeof tab_files_data.filestats_scan_finetune === 'object') {
    //     if(Object.keys(tab_files_data.filestats_scan_db).length > 0) {
    //         stats_db.style.display = 'block';
    //         const db_accepted = document.querySelector('.sources-stats-db-accepted');
    //         db_accepted.innerHTML = `Accepted: ${tab_files_data.filestats_scan_db.accepted}`;
    //         db_accepted.href = `/tab-files-log?phase=scan&accepted_or_rejected=accepted`;
    //         const db_rejected = document.querySelector('.sources-stats-db-rejected');
    //         db_rejected.innerHTML = `Rejected: ${tab_files_data.filestats_scan_db.rejected}`;
    //         db_rejected.href = `/tab-files-log?phase=scan&accepted_or_rejected=rejected`;
    //     }
    // }
}

function upload_url() {
    const fileInput = document.querySelector('#tab-upload-url-input');
    if (!fileInput || fileInput.value === '') {
        return;
    }

    const url_regex = /^(ftp|http|https):\/\/[^ "]+$/;
    const is_url = url_regex.test(fileInput.value);
    if (!is_url) {
        handle_invalid_url();
        return;
    }

    const formData = {
        'url': fileInput.value
    };

    fetch('/tab-files-upload-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
        .then(response => {
            if (!response.ok) {
                return response.json()
                    .then(error => {
                        throw new Error(error.message);
                    });
            }
            return response.json();
        })
        .then(data => {
            process_now_update_until_finished()
            fileInput.value = '';
            document.querySelector('#status-url').innerHTML = '';
            let url_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('upload-tab-url-modal'));
            url_modal.hide();
        })
        .catch(error => {
            document.querySelector('#status-url').innerHTML = error.message;
        });
}

function handle_invalid_url() {
    const error = new Error('Invalid URL');
    document.querySelector('#status-url').innerHTML = error.message;
}


function upload_repo() {
    const gitUrl = document.querySelector('#tab-upload-git-input');
    const gitBranch = document.querySelector('#tab-upload-git-brach-input');
    if (!gitUrl || gitUrl.value == '') {
        return;
    }
    const formData = {
        'url': gitUrl.value
    };
    if (gitBranch.value && gitBranch.value !== '') {
        formData['branch'] = gitBranch.value;
    }

    fetch('/tab-files-repo-upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json()
                .then(error => {
                    throw new Error(error.message);
                });
        }
        return response.text();
    })
    .then(data => {
        process_now_update_until_finished();
        gitUrl.value = '';
        gitBranch.value = '';
        let git_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('upload-tab-git-modal'));
        git_modal.hide();
    })
    .catch(error => {
        document.querySelector('#status-git').innerHTML = error.message;
    });
}

function upload_file() {
    const fileInput = document.querySelector('#tab-upload-file-input');
    if(fileInput.files.length === 0) {
        return;
    }
    var formdata = new FormData();
    formdata.append("file", fileInput.files[0]);
    document.querySelector('.progress').classList.toggle('d-none');
    document.querySelector('.tab-upload-file-submit').classList.toggle('d-none');
    var ajax = new XMLHttpRequest();
    ajax.upload.addEventListener("progress", progressHandler, false);
    ajax.addEventListener("load", completeHandler, false);
    ajax.addEventListener("error", errorHandler, false);
    ajax.addEventListener("abort", abortHandler, false);
    ajax.open("POST", "/tab-files-upload");
    ajax.send(formdata);
}

function progressHandler(event) {
    document.querySelector('#loaded_n_total').innerHTML = "Uploaded " + event.loaded + " bytes of " + event.total;
    var percent = (event.loaded / event.total) * 100;
    document.querySelector('.progress-bar').setAttribute('aria-valuenow', Math.round(percent));
    document.querySelector('.progress-bar').style.width = Math.round(percent) + "%";
    document.querySelector('#status').innerHTML = Math.round(percent) + "% uploaded... please wait";
  }

  function completeHandler(event) {
    document.querySelector('#status').innerHTML = event.target.responseText;
    if(event.target.status === 200) {
        setTimeout(() => {
            process_now_update_until_finished();
            document.querySelector('#tab-upload-file-input').value = '';
            let file_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('upload-tab-files-modal'));
            file_modal.hide();
        }, 500);
    } else {
        let error_msg = JSON.parse(event.target.responseText);
        const file_modal = document.getElementById('upload-tab-files-modal');
        file_modal.querySelector('.progress-bar').setAttribute('aria-valuenow', 0);
        file_modal.querySelector('.progress').classList.add('d-none');
        file_modal.querySelector('.tab-upload-file-submit').classList.remove('d-none');
        file_modal.querySelector('#loaded_n_total').innerHTML = "";
        file_modal.querySelector('#status').innerHTML = error_msg.message;
    }
  }

  function errorHandler(event) {
    document.querySelector('#status').innerHTML = event.target.responseText.message;
  }

  function abortHandler(event) {
    document.querySelector('#status').innerHTML = "Upload Aborted";
}

function delete_file(file) {
    fetch("/tab-files-delete", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({'delete_this':file})
    })
    .then(function(response) {
        process_now_update_until_finished();
        console.log(response);
    });
}

function change_events() {
    document.querySelectorAll('#upload-tab-table-body-files input').forEach(function(element) {
        removeEventListener('change',element);
        element.addEventListener('change', function() {
            save_tab_files();
        });
    });
}

function save_tab_files() {
    const files = document.querySelectorAll("#upload-tab-table-body-files tr");
    const data = {};
    const uploaded_files = {};
    let i = 0;
    files.forEach(function(element) {
        const name = element.dataset.file;
        const which_set = element.querySelector(`input[name="file-which[${i}]"]:checked`).value;
        uploaded_files[name] = {
            which_set: which_set,
        }
        i++;
    });
    data.uploaded_files = uploaded_files;
    console.log('data', data);
    fetch("/tab-files-save-config", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(function(response) {
        console.log('tab-files-save-config',tab-files-save-config);
        if(response.ok) {
            get_tab_files();
        }
    });
}

const process_now_update_until_finished = async () => {
    const process_button = document.querySelector('.tab-files-process-now');
    process_button.disabled = true;
    process_button.dataset.loading = true;
};

function file_status_color(status) {
    let status_color;
    switch (status) {
        case 'starting':
            status_color = `bg-success`;
            break;
        case 'working':
            status_color = `bg-secondary`;
            break;
        case 'completed':
            status_color = `bg-primary`;
            break;
        case 'failed':
            status_color = `bg-danger`;
            break;
    }
    return status_color;
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

function save_filter_setup() {
    let include_file_types = null;
    const unchecked_types = document.querySelectorAll('.upload-tab-table-type-body tr input[type="checkbox"]:not(:checked)')
    if(unchecked_types.length > 0) {
        include_file_types = {};
        unchecked_types.forEach(function(element) {
            include_file_types[element.dataset.name] = false;
        });
    }
    const force_include = document.querySelector('#force_include').value;
    const force_exclude = document.querySelector('#force_exclude').value;
    fetch("/tab-files-filetypes-setup", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filetypes_finetune: include_file_types,
            force_include: force_include,
            force_exclude: force_exclude,
        })
    })
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

export function init() {
    sources_run_button.addEventListener('click', run_stop_filtering)
    const tab_upload_file_submit = document.querySelector('.tab-upload-file-submit');
    tab_upload_file_submit.removeEventListener('click', upload_file());
    tab_upload_file_submit.addEventListener('click', function() {
        upload_file();
    });

    const tab_upload_url_submit = document.querySelector('.tab-upload-url-submit');
    tab_upload_url_submit.removeEventListener('click', upload_url());
    tab_upload_url_submit.addEventListener('click', function() {
        upload_url();
    });

    const tab_upload_git_submit = document.querySelector('.tab-upload-git-submit');
    tab_upload_git_submit.removeEventListener('click', upload_repo());
    tab_upload_git_submit.addEventListener('click', function() {
        upload_repo();
    });

    const process_button = document.querySelector('.tab-files-process-now');
    process_button.addEventListener('click', function() {
        fetch("/tab-files-process-now")
            .then(function(response) {
                process_now_update_until_finished();
            });
    });

    const file_modal = document.getElementById('upload-tab-files-modal');
    file_modal.addEventListener('show.bs.modal', function () {
        file_modal.querySelector('#tab-upload-file-input').value = '';
        file_modal.querySelector('.progress-bar').setAttribute('aria-valuenow', 0);
        file_modal.querySelector('.progress').classList.add('d-none');
        file_modal.querySelector('.tab-upload-file-submit').classList.remove('d-none');
        file_modal.querySelector('#status').innerHTML = '';
        file_modal.querySelector('#loaded_n_total').innerHTML = '';
    });

    const url_modal = document.getElementById('upload-tab-url-modal');
    url_modal.addEventListener('show.bs.modal', function () {
        url_modal.querySelector('#tab-upload-url-input').value = '';
        url_modal.querySelector('#status-url').innerHTML = '';
    });

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

    const git_modal = document.getElementById('upload-tab-git-modal');
    git_modal.addEventListener('show.bs.modal', function () {
        get_ssh_keys();
        git_modal.querySelector('#tab-upload-git-input').value = '';
        git_modal.querySelector('#tab-upload-git-brach-input').value = '';
        git_modal.querySelector('#status-git').innerHTML = '';
    });

    const ssh_link = document.querySelector('.ssh-link');
    ssh_link.addEventListener('click', function(event) {
        event.preventDefault()
        const ssh_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('upload-tab-git-modal'));
        ssh_modal.hide();
    });
    let delete_modal_button = document.querySelector('.delete-modal-submit');
    delete_modal_button.addEventListener('click', function() {
        if(this.dataset.file && this.dataset.file !== '') {
            delete_file(this.dataset.file);
            this.dataset.file = "";
        }
        let delete_modal_instance = bootstrap.Modal.getOrCreateInstance(document.getElementById('delete-modal'));
        delete_modal_instance.hide();
        process_now_update_until_finished();
    });

    const force_include = document.getElementById('force_include');
    force_include.addEventListener("input", function () {
        force_include_exclude_is_changed = true;
    })
    force_include.addEventListener("change", function () {
        dont_disable_file_types = true;
        save_filter_setup();
        force_include_exclude_is_changed = false;
    })
    const force_exclude = document.getElementById('force_exclude');
    force_exclude.addEventListener("input", function () {
        force_include_exclude_is_changed = true;
    })
    force_exclude.addEventListener("change", function () {
        dont_disable_file_types = true;
        save_filter_setup();
        force_include_exclude_is_changed = false;
    })

    const scan_error_toast = document.querySelector('.upload-tab-scan-error-toast');
    scan_error_toast.addEventListener('hidden.bs.toast', () => {
        show_scan_error = false;
    })

    const mime_sort = document.querySelector('.upload-tab-table-mime-sort');
    mime_sort.addEventListener('click', (event) => {
        sort_type = 'filetype';
        sort_started = true;
        if(event.target.classList.contains('bi-caret-up-fill')) {
            sort_order = 'desc';
            event.target.classList.remove('bi-caret-up-fill');
            event.target.classList.add('bi-caret-down-fill');
        } else {
            sort_order = 'asc';
            event.target.classList.remove('bi-caret-down-fill');
            event.target.classList.add('bi-caret-up-fill');
        }
    });

    const count_sort = document.querySelector('.upload-tab-table-count-sort');
    count_sort.addEventListener('click', (event) => {
        sort_type = 'count';
        sort_started = true;
        if(event.target.classList.contains('bi-caret-up-fill')) {
            sort_order = 'desc';
            event.target.classList.remove('bi-caret-up-fill');
            event.target.classList.add('bi-caret-down-fill');
        } else {
            sort_order = 'asc';
            event.target.classList.remove('bi-caret-down-fill');
            event.target.classList.add('bi-caret-up-fill');
        }
    });

    const checkall_button = document.querySelector('.filetypes-checkall');
    checkall_button.addEventListener('click', function() {
        const file_inputs = document.querySelectorAll('.upload-tab-table-type-body .enabled-file input[type="checkbox"]');
        for (let i = 0; i < file_inputs.length; i++) {
            file_inputs[i].checked = true;
        }
        save_filter_setup();
    });

    const uncheckall_button = document.querySelector('.filetypes-uncheckall');
    uncheckall_button.addEventListener('click', function() {
        const file_inputs = document.querySelectorAll('.upload-tab-table-type-body .enabled-file input[type="checkbox"]');
        for (let i = 0; i < file_inputs.length; i++) {
            file_inputs[i].checked = false;
        }
        save_filter_setup();
    });
}

export function tab_switched_here() {
    get_tab_files();
}

export function tab_switched_away() {
    dont_disable_file_types = false;
}

export function tab_update_each_couple_of_seconds() {
    get_tab_files();
}