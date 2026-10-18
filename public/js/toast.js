export function showToast(message){
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.classList.add('toast');
    document.querySelector('#toast-root').append(toast);
    setTimeout(() => toast.remove(), 4000);
}