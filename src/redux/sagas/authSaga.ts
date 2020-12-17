import { call, put, select } from 'redux-saga/effects';

import firebase from 'firebase/firebase';
import { history } from 'routers/AppRouter';

import { EAuthActionType } from 'constants/constants';

import {
	signInSuccess,
	signOutSuccess,
	isAuthenticating
} from '../actions/authActions';
import { setAuthStatus } from '../actions/miscActions';

import { clearBasket, setBasketItems } from '../actions/basketActions';
import { setProfile, clearProfile } from '../actions/profileActions';
import { resetFilter } from '../actions/filterActions';
import { resetCheckout } from '../actions/checkoutActions';

import defaultAvatar from 'images/defaultAvatar.jpg';
import defaultBanner from 'images/defaultBanner.jpg';
import { IUser } from 'types/types';

function* handleError(e) {
	const obj = { success: false, type: 'auth' };
	yield put(isAuthenticating(false));

	switch (e.code) {
		case 'auth/network-request-failed':
			yield put(setAuthStatus({ ...obj, message: 'Network error has occured. Please try again.' }));
			break;
		case 'auth/email-already-in-use':
			yield put(setAuthStatus({ ...obj, message: 'Email is already in use. Please use another email' }));
			break;
		case 'auth/wrong-password':
			yield put(setAuthStatus({ ...obj, message: 'Incorrect email or password' }));
			break;
		case 'auth/user-not-found':
			yield put(setAuthStatus({ ...obj, message: 'Incorrect email or password' }));
			break;
		case 'auth/reset-password-error':
			yield put(setAuthStatus({ ...obj, message: 'Failed to send password reset email. Did you type your email correctly?' }));
			break;
		default:
			yield put(setAuthStatus({ ...obj, message: e.message }));
			break;
	}
}

function* initRequest() {
	yield put(isAuthenticating());
	yield put(setAuthStatus({}));
}

function* authSaga({ type, payload }) {
	switch (type) {
		case EAuthActionType.SIGNIN:
			try {
				yield initRequest();
				yield call(firebase.signIn, payload.email, payload.password);
			} catch (e) {
				yield handleError(e);
			}
			break;
		case EAuthActionType.SIGNIN_WITH_GOOGLE:
			try {
				yield initRequest();
				yield call(firebase.signInWithGoogle);
			} catch (e) {
				yield handleError(e);
			}
			break;
		case EAuthActionType.SIGNIN_WITH_FACEBOOK:
			try {
				yield initRequest();
				yield call(firebase.signInWithFacebook);
			} catch (e) {
				yield handleError(e);
			}
			break;
		case EAuthActionType.SIGNIN_WITH_GITHUB:
			try {
				yield initRequest();
				yield call(firebase.signInWithGithub);
			} catch (e) {
				yield handleError(e);
			}
			break;
		case EAuthActionType.SIGNUP:
			try {
				yield initRequest();

				const ref = yield call(firebase.createAccount, payload.email, payload.password);
				const fullname = payload.fullname.split(' ').map(name => name[0].toUpperCase().concat(name.substring(1))).join(' ');
				const user: IUser = {
					fullname,
					avatar: defaultAvatar,
					banner: defaultBanner,
					email: payload.email,
					basket: [],
					address: '',
					mobile: { data: {} },
					role: 'USER',
					dateJoined: ref.user.metadata.creationTime || new Date().getTime()
				};
				const { basket } = yield select();

				yield call(firebase.addUser, ref.user.uid, user);
				yield put(setBasketItems(basket));
				yield put(setProfile(user));
				yield put(isAuthenticating(false));
			} catch (e) {
				yield handleError(e);
			}
			break;
		case EAuthActionType.SIGNOUT:
			try {
				yield initRequest();
				yield call(firebase.signOut);
				yield put(clearBasket());
				yield put(clearProfile());
				yield put(resetFilter());
				yield put(resetCheckout());
				yield put(signOutSuccess());
				yield put(isAuthenticating(false));
				yield call(history.push, '/signin');
			} catch (e) {
				console.log(e);
			}
			break;
		case EAuthActionType.RESET_PASSWORD:
			try {
				yield initRequest();
				yield call(firebase.passwordReset, payload);
				yield put(setAuthStatus({
					success: true,
					type: 'reset',
					message: 'Password reset email has been sent to your provided email.'
				}));
				yield put(isAuthenticating(false));
			} catch (e) {
				handleError({ code: 'auth/reset-password-error' });
			}
			break;
		case EAuthActionType.ON_AUTHSTATE_SUCCESS:
			yield put(setAuthStatus({
				success: true,
				type: 'auth',
				message: 'Successfully signed in. Redirecting...'
			}));
			// yield call(history.push, '/');
			const snapshot = yield call(firebase.getUser, payload.uid);

			if (snapshot.data()) { // if user exists in database
				const user = snapshot.data();
				console.log(user);
				yield put(setProfile(user));
				yield put(setBasketItems(user.basket));
				yield put(signInSuccess({
					id: payload.uid,
					role: user.role,
					provider: payload.providerData[0].providerId
				}));
			} else if (payload.providerData[0].providerId !== 'password' && !snapshot.data()) {
				// add the user if auth provider is not password
				const { basket } = yield select();
				const user: IUser = {
					fullname: payload.displayName ? payload.displayName : 'User',
					avatar: payload.photoURL ? payload.photoURL : defaultAvatar,
					banner: defaultBanner,
					email: payload.email,
					address: '',
					basket,
					mobile: { data: {} },
					role: 'USER',
					dateJoined: payload.metadata.creationTime
				};
				yield call(firebase.addUser, payload.uid, user);
				yield put(setProfile(user));
				yield put(setBasketItems(basket));
				yield put(signInSuccess({
					id: payload.uid,
					role: user.role,
					provider: payload.providerData[0].providerId
				}));
			}
			yield put(isAuthenticating(false));
			break;
		case EAuthActionType.ON_AUTHSTATE_FAIL:
			yield put(clearProfile());
			yield put(signOutSuccess());
			break;
		case EAuthActionType.SET_AUTH_PERSISTENCE:
			try {
				yield call(firebase.setAuthPersistence);
			} catch (e) {
				console.log(e);
			}
			break;
		default:
			return;
	}
}

export default authSaga;