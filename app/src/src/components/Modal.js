import React from 'react';
import PropTypes from 'prop-types';
import Dialog from './Dialog.js';


import './Modal.css';

const withModals = (Component, modals) => {
	let e =  (props) => 
		<ModalProvider list={modals}>
			<Component {...props}/> 
		</ModalProvider>;
	e.displayName = `withModals(${Component.displayName || Component.name})`;
	return e;
};

let s = (v) => typeof v === 'string' ? () => v : v;

class ModalProvider extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			curModal: false
		};

		this.formHandler = {
			isFirstElementFocus: true,
			
			value: (name) => this.state.curModal.form[name] || '',
			onChange: (name) => ({target}) => {this.setState({
				curModal: {
					...this.state.curModal,
					form: {
						...this.state.curModal.form,
						[name]: target.value
					}
				}
			});},
			close: ()=>this.closeModal(),
			form: new Proxy({}, {
				get: (target, name) => {
					return this.state.curModal.form[name] || '';
				}
			}),
			vars: new Proxy({}, {
				get: (target, name) => {
					return this.state.curModal.formVars[name];
				},
				set: (target, name, value) => {
					setTimeout(()=>{
						if(this.state.curModal)
							this.setState({
								curModal: {
									...this.state.curModal,
									formVars: {
										...this.state.curModal.formVars,
										[name]: value
									}
								}	
							});
					},0);
					return true;
				}
			})
		};
	}

	showModal(id, vars = {}){
		let settings = typeof id == 'string' ? this.props.list[id] : id;

		vars = {success: ()=>true, ...vars};
		this.formHandler.isFirstElementFocus = true;
		this.setState({curModal: {settings, vars, form: {}, formVars: {}}});
	}

	closeModal() {
		this.setState({curModal: false});
	}

	render(){
		let {curModal} = this.state;
		let child = React.cloneElement(React.Children.only(this.props.children), {showModal: (id, vars)=>this.showModal(id,vars)});
		return (
		<div>
			{child}
			<Dialog show={!!curModal} hide={()=>{
				curModal.settings.actions.find((e)=>e.onHide).callback({...this.formHandler, form: this.state.curModal.form}, curModal.vars);
				this.closeModal();
			}} style={{'width': '710px', 'height': 'auto'}}>
				{curModal && <div className='modal'> 
					<h1 className='header'> {s(curModal.settings.title)(curModal.vars)} </h1>
					<form className='content' onSubmit={(e)=>{
						e.preventDefault();
						curModal.settings.actions.find((e)=>e.onSubmit).callback({...this.formHandler, form: this.state.curModal.form}, curModal.vars);
					}}>
					{
						curModal.settings.content(this.formHandler)
					}
					</form>
					<div className='actions'> 
					{
						curModal.settings.actions.map((e)=>{
							e = {type: true, name:'', ...e};
							return <span key={e.name} onClick={()=>e.callback({...this.formHandler, form: this.state.curModal.form}, curModal.vars)}> {e.name} </span>;
						})
					} 
					</div>
				</div>}
			</Dialog>
		</div>
		);
	}
}

ModalProvider.propTypes = {
	list: PropTypes.object,
	children: PropTypes.element.isRequired
};

const trueOrUndefined = (v) => (v === true || typeof v === 'undefined');

ModalProvider.ACTIONS = {
	CANCEL: (formHandler)=> (formHandler.close()),
	OK :(formHandler, vars) => (trueOrUndefined(vars.success(formHandler, vars)) && formHandler.close())
};


ModalProvider.FORMS = {
	FORM: () => {},
	makeForm(f) {
		f.prototype = ModalProvider.FORMS.FORM;
		return f;
	},
	TEXTFIELD: (v) => {
		let {name, onChange, ...props} = (typeof v === 'string') ? {name: v, onChange: false} : v;
		return ModalProvider.FORMS.makeForm((formHandler) => {
			let add = {};
			if(formHandler.isFirstElementFocus){
				formHandler.isFirstElementFocus = false;
				add = {autoFocus: true};
			}
			return <input {...add} key={name} type='text' {...props} value={formHandler.value(name)} onChange={(e)=>{
				if(onChange){ 
					let v = onChange(e, formHandler); 
					if(v !== undefined) {
						if(v)
							formHandler.onChange(name)(e);
					}
					else {
						formHandler.onChange(name)(e);
					}
				}
				else formHandler.onChange(name)(e);
			}}/>;
		});
	},
	PASSWORD: (v) => {
		let {name, onChange, ...props} = (typeof v === 'string') ? {name: v, onChange: false} : v;
		return ModalProvider.FORMS.makeForm((formHandler) => {
			let add = {};
			if(formHandler.isFirstElementFocus){
				formHandler.isFirstElementFocus = false;
				add = {autoFocus: true};
			}
			return <input {...add} key={name} type='password' {...props} value={formHandler.value(name)} onChange={(e)=>{
				if(onChange){ 
					let v = onChange(e, formHandler); 
					if(v !== undefined) {
						if(v)
							formHandler.onChange(name)(e);
					}
					else {
						formHandler.onChange(name)(e);
					}
				}
				else formHandler.onChange(name)(e);
			}}/>;
		});
	}
};


export default ModalProvider;
export {withModals};
