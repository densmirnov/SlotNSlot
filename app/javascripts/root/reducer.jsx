import { fromJS } from 'immutable';
import { ACTION_TYPES } from './actions';

export const ROOT_INITIAL_STATE = fromJS({
  isLoading: false,
  hasError: false,
  account: null,
  balance: 0,
});

export function reducer(state = ROOT_INITIAL_STATE, action) {
  switch (action.type) {
    case ACTION_TYPES.START_TO_GET_ACCOUNT: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', true).set('hasError', false);
      });
    }

    case ACTION_TYPES.FETCH_ACCOUNT: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', false).set('account', action.payload.account);
      });
    }

    case ACTION_TYPES.FAILED_TO_GET_ACCOUNT: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', false).set('hasError', true);
      });
    }

    case ACTION_TYPES.SET_TOTAL_COIN_BALANCE: {
      return state.set('balance', action.payload.balance);
    }

    case ACTION_TYPES.UPDATE_BALANCE: {
      return state.set('balance', state.get('balance').plus(action.payload.diffMoney));
    }

    default:
      return state;
  }
}
