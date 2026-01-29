// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Form handling
const quoteForm = document.getElementById('quoteForm');

if (quoteForm) {
    quoteForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitButton = quoteForm.querySelector('button[type="submit"]');
        if (!submitButton) return;

        // Prevent double submissions
        if (submitButton.disabled) {
            return;
        }

        const originalText = submitButton.textContent;
        
        // Get form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            company: document.getElementById('company').value.trim(),
            pickup: document.getElementById('pickup').value.trim(),
            delivery: document.getElementById('delivery').value.trim(),
            freightType: Array.from(document.querySelectorAll('input[name="freight-type"]:checked'))
                .map(checkbox => checkbox.value)
        };
        
        // Basic validation
        const errors = [];

        if (!formData.name || !formData.phone || !formData.email || !formData.pickup || !formData.delivery) {
            errors.push('Please fill in all required fields.');
        }

        // Require at least one freight type
        if (formData.freightType.length === 0) {
            errors.push('Please select at least one freight type.');
        }

        // Loosely validate NZ phone number: starts with 0 and 8–11 digits total (ignoring spaces)
        const phoneDigits = formData.phone.replace(/\s+/g, '');
        if (phoneDigits && !/^0\d{7,10}$/.test(phoneDigits)) {
            errors.push('Please enter a valid NZ phone number.');
        }

        // Basic email format validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailPattern.test(formData.email)) {
            errors.push('Please enter a valid email address.');
        }

        if (errors.length > 0) {
            showMessage(errors[0], 'error');
            return;
        }
        
        // Disable form during submission
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        
        try {
            const response = await fetch('/api/quote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok && response.status === 200) {
                // Success - show success message
                showMessage('Quote request submitted successfully! We\'ll get back to you soon.', 'success');
                submitButton.textContent = 'Quote Requested! ✓';
                submitButton.style.background = 'var(--success-color)';
                
                // Reset form after 3 seconds
                setTimeout(() => {
                    quoteForm.reset();
                    submitButton.textContent = originalText;
                    submitButton.style.background = '';
                    submitButton.disabled = false;
                    clearMessage();
                }, 3000);
            } else {
                // Server returned an error
                const errorMessage = data.error || data.message || 'An error occurred while submitting your request. Please try again.';
                showMessage(errorMessage, 'error');
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        } catch (error) {
            // Network error or other exception
            console.error('Form submission error:', error);
            showMessage('Unable to submit your request. Please check your internet connection and try again.', 'error');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });
}

// Helper function to show messages
function showMessage(message, type) {
    // Remove any existing message
    clearMessage();
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.id = 'form-message';
    messageDiv.className = `form-message form-message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 5px;
        font-weight: 500;
        ${type === 'success' 
            ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' 
            : 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
        }
    `;
    
    // Insert message before submit button
    const submitButton = quoteForm.querySelector('button[type="submit"]');
    if (submitButton && submitButton.parentNode) {
        submitButton.parentNode.insertBefore(messageDiv, submitButton);
    }
}

// Helper function to clear messages
function clearMessage() {
    const existingMessage = document.getElementById('form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', function() {
    const animatedElements = document.querySelectorAll('.step, .hero-text, .hero-image');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Phone number formatting
const phoneInput = document.getElementById('phone');
if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0) {
            if (value.startsWith('0')) {
                // Format NZ phone numbers
                if (value.length <= 3) {
                    value = value;
                } else if (value.length <= 6) {
                    value = value.slice(0, 3) + ' ' + value.slice(3);
                } else if (value.length <= 8) {
                    value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
                } else {
                    value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6, 10);
                }
            }
        }
        e.target.value = value;
    });
}
