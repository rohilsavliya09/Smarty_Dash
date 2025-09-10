import { useState, useEffect } from 'react';
import axios from 'axios';
import './Projects.css';

function Projects() {
    const [projects, setProjects] = useState([]);
    const [PR_showModal, PR_setShowModal] = useState(false);
    const [PR_editingProject, PR_setEditingProject] = useState(null);
    const [PR_deleteProject, PR_setDeleteProject] = useState(null);
    const [PR_deleteInput, PR_setDeleteInput] = useState('');
    const [PR_loadingEmail, PR_setLoadingEmail] = useState(false);

    // NEW: email UI state
    const [PR_emailMessage, PR_setEmailMessage] = useState(''); // message to show in modal
    const [PR_emailSuccess, PR_setEmailSuccess] = useState(null); // null / true / false
    const [PR_lastSentData, PR_setLastSentData] = useState(null); // stores last sent projectData

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        functionality: '',
        technologies: '',
        status: 'Idea',
        notes: '',
        toEmail: '' // email field for sending project
    });
    const [PR_showScrollTop, PR_setShowScrollTop] = useState(false);

    const userId = localStorage.getItem("id") || "Guest1234";

    const API_URL = 'http://localhost:5000/api/projects';

    const fetchProjects = async () => {
        try {
            const res = await axios.get(`${API_URL}/${userId}`);
            setProjects(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        const checkScroll = () => PR_setShowScrollTop(window.scrollY > 300);
        window.addEventListener('scroll', checkScroll);
        return () => window.removeEventListener('scroll', checkScroll);
    }, []);

    const handleAddBoxClick = () => {
        PR_setEditingProject(null);
        setFormData({
            title: '',
            description: '',
            functionality: '',
            technologies: '',
            status: 'Idea',
            notes: '',
            toEmail: ''
        });
        // reset email messages when opening new form
        PR_setEmailMessage('');
        PR_setEmailSuccess(null);
        PR_setLastSentData(null);
        PR_setShowModal(true);
    };

    const handleProjectBoxClick = (project) => {
        PR_setEditingProject(project);
        setFormData({ ...project, toEmail: '' }); // reset email field
        // reset email messages when opening for edit
        PR_setEmailMessage('');
        PR_setEmailSuccess(null);
        PR_setLastSentData(null);
        PR_setShowModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataWithUser = { ...formData, userId };
            if (PR_editingProject) {
                const res = await axios.put(`${API_URL}/${PR_editingProject._id}`, dataWithUser);
                setProjects(projects.map(p => p._id === PR_editingProject._id ? res.data : p));
            } else {
                const res = await axios.post(API_URL, dataWithUser);
                setProjects([res.data, ...projects]);
            }
            PR_setShowModal(false);
        } catch (err) {
            console.error(err);
        }
    };

    // helper to render multiline text in preview
    const renderMultiline = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>);
    };

    const handleSendEmail = async () => {
        if (!formData.toEmail) {
            PR_setEmailMessage('Please enter a recipient email.');
            PR_setEmailSuccess(false);
            return;
        }

        // reset previous status
        PR_setEmailMessage('');
        PR_setEmailSuccess(null);
        PR_setLoadingEmail(true);

        const payload = {
            toEmail: formData.toEmail,
            projectData: {
                title: formData.title,
                description: formData.description,
                functionality: formData.functionality,
                technologies: formData.technologies,
                status: formData.status,
                notes: formData.notes
            }
        };

        try {
            const res = await axios.post("http://localhost:5000/api/projects/send-email", payload);

            // success - show message in modal and store sent data to preview
            PR_setEmailMessage('Project details sent successfully.');
            PR_setEmailSuccess(true);
            PR_setLastSentData(payload.projectData);

            // clear only email field (keep project fields)
            setFormData({ ...formData, toEmail: '' });

        } catch (err) {
            console.error("Send email error:", err);
            // Grab message if backend returned error text
            const backendMsg = err?.response?.data?.message || err.message || 'Failed to send email.';
            PR_setEmailMessage(`Failed to send email: ${backendMsg}`);
            PR_setEmailSuccess(false);
        } finally {
            PR_setLoadingEmail(false);
        }
    };

    const handleDelete = async () => {
        if (!PR_deleteProject || PR_deleteInput !== PR_deleteProject.title) return;
        try {
            await axios.delete(`${API_URL}/${PR_deleteProject._id}/${userId}`);
            setProjects(projects.filter(p => p._id !== PR_deleteProject._id));
            PR_setDeleteProject(null);
            PR_setDeleteInput('');
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusClass = (status) => `PR-status-${status.toLowerCase()}`;
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <div className="PR-container">
            <div className="PR-header-info">
                Manage your development projects. Click + to create a new project or click on existing projects to edit.
            </div>

            <div id="projects" className="PR-boxes-container">
                {projects.map((project, index) => (
                    <div key={project._id} className="PR-box PR-project-box" style={{ animationDelay: `${index * 0.1}s` }}>
                        <div onClick={() => handleProjectBoxClick(project)}>
                            <div className="PR-project-title">{project.title || 'Untitled Project'}</div>
                        </div>
                        <button className="PR-delete-btn" onClick={() => PR_setDeleteProject(project)}>Delete</button>
                    </div>
                ))}
                <div className="PR-box PR-add-box" onClick={handleAddBoxClick}>+</div>
            </div>

            {/* Project Create/Edit Modal */}
            {PR_showModal && (
                <div className="PR-modal-overlay">
                    <div className="PR-modal">
                        <h2>{PR_editingProject ? 'EDIT PROJECT' : 'CREATE NEW PROJECT'}</h2>
                        <div className="PR-cyber-line"></div>
                        <form onSubmit={handleSubmit}>
                            <div className="PR-form-group">
                                <label>PROJECT TITLE</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
                            </div>
                            <div className="PR-form-group">
                                <label>PROJECT DESCRIPTION</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} />
                            </div>
                            <div className="PR-form-group">
                                <label>FUNCTIONALITY / FEATURES</label>
                                <textarea name="functionality" value={formData.functionality} onChange={handleInputChange} />
                            </div>
                            <div className="PR-form-group">
                                <label>TECHNOLOGIES USED</label>
                                <input type="text" name="technologies" value={formData.technologies} onChange={handleInputChange} />
                            </div>
                            <div className="PR-form-group">
                                <label>PROJECT STATUS</label>
                                <select name="status" value={formData.status} onChange={handleInputChange}>
                                    <option value="Idea">Idea</option>
                                    <option value="Designing">Designing</option>
                                    <option value="Developing">Developing</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div className="PR-form-group">
                                <label>NOTES / EXTRA INFO</label>
                                <textarea name="notes" value={formData.notes} onChange={handleInputChange} />
                            </div>

                            {/* Email send field */}
                            <div className="PR-form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="email"
                                    name="toEmail"
                                    value={formData.toEmail}
                                    placeholder="Enter recipient email"
                                    onChange={handleInputChange}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="PR-send-btn"
                                    onClick={handleSendEmail}
                                    disabled={PR_loadingEmail}
                                    aria-busy={PR_loadingEmail}
                                >
                                    {PR_loadingEmail ? <div className="PR-spinner" /> : 'SEND DATA'}
                                </button>
                            </div>

                            {/* NEW: inline email status message */}
                            {PR_emailMessage && (
                                <div className={`PR-email-message ${PR_emailSuccess ? 'PR-success' : 'PR-error'}`}>
                                    {PR_emailMessage}
                                </div>
                            )}

                            {/* NEW: preview of last sent data */}
                            {PR_lastSentData && (
                                <div className="PR-sent-preview">
                                    <h3>Last sent data</h3>
                                    <p><b>Title:</b> {PR_lastSentData.title || '-'}</p>
                                    <p><b>Description:</b><br/>{renderMultiline(PR_lastSentData.description)}</p>
                                    <p><b>Functionality:</b><br/>{renderMultiline(PR_lastSentData.functionality)}</p>
                                    <p><b>Technologies:</b><br/>{renderMultiline(PR_lastSentData.technologies)}</p>
                                    <p><b>Status:</b> {PR_lastSentData.status || '-'}</p>
                                    <p><b>Notes:</b><br/>{renderMultiline(PR_lastSentData.notes)}</p>
                                </div>
                            )}

                            <div className="PR-button-group">
                                <button type="button" className="PR-cancel-btn" onClick={() => PR_setShowModal(false)}>CANCEL</button>
                                <button type="submit" className="PR-submit-btn">{PR_editingProject ? 'UPDATE' : 'CREATE'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {PR_deleteProject && (
                <div className="PR-modal-overlay">
                    <div className="PR-modal">
                        <h2>CONFIRM DELETE</h2>
                        <div className="PR-cyber-line"></div>
                        <p>Type <b>{PR_deleteProject.title}</b> to confirm delete:</p>
                        <input
                            type="text"
                            value={PR_deleteInput}
                            onChange={(e) => PR_setDeleteInput(e.target.value)}
                            placeholder="Enter project title"
                        />
                        <div className="PR-button-group">
                            <button className="PR-cancel-btn" onClick={() => PR_setDeleteProject(null)}>CANCEL</button>
                            <button
                                className="PR-delete-btn"
                                disabled={PR_deleteInput !== PR_deleteProject.title}
                                onClick={handleDelete}
                            >
                                CONFIRM DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`PR-scroll-top ${PR_showScrollTop ? 'visible' : ''}`} onClick={scrollToTop}>↑</div>
        </div>
    );
}

export default Projects;
