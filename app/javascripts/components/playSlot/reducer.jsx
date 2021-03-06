import { fromJS } from 'immutable';
import Big from 'big.js';
import { ACTION_TYPES } from './actions';
import Web3Service from '../../helpers/web3Service';

const emotionTypes = ['Thank', 'Threaten', 'Oops', 'Sorry', 'Well Played', 'Greetings'];

export const PLAY_SLOT_INITIAL_STATE = fromJS({
  isLoading: false,
  isPlaying: false,
  isOccupied: false,
  hasError: false,
  betSize: Big(20),
  lineNum: 1,
  deposit: Big(0),
  bankRoll: Big(0),
  betUnit: Big(2),
  minBet: Big(2),
  maxBet: Big(20),
  emotionClicked: 0,
  emotionList: emotionTypes,
  betsData: [],
  temporaryBetData: {},
  slotMachineContract: null,
  slotName: '',
  waitOccupy: false,
  isBreakAway: false,
});

export function reducer(state = PLAY_SLOT_INITIAL_STATE, action) {
  switch (action.type) {
    case ACTION_TYPES.START_TO_SEND_ETHER_TO_CONTRACT:
    case ACTION_TYPES.START_TO_GET_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', true).set('hasError', false);
      });
    }

    case ACTION_TYPES.FAILED_TO_GET_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', false).set('hasError', true);
      });
    }

    case ACTION_TYPES.SET_DEPOSIT: {
      return state.set('deposit', action.payload.ethValue);
    }

    case ACTION_TYPES.SET_OCCUPIED_STATE: {
      return state.withMutations(currentState => {
        return currentState.set('isOccupied', action.payload.occupied).set('isBreakAway', action.payload.isBreakAway);
      });
    }

    case ACTION_TYPES.SUCCEEDED_TO_GET_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState
          .set('isLoading', false)
          .set('hasError', false)
          .set('minBet', action.payload.minBet) // Big Number
          .set('betSize', action.payload.minBet) // Big Number
          .set('maxBet', action.payload.maxBet) // Big Number
          .set('betUnit', action.payload.minBet) // Big Number
          .set('bankRoll', action.payload.bankRoll) // Big Number
          .set('deposit', action.payload.playerBalance) // Big Number
          .set('slotMachineContract', action.slotMachineContract)
          .set('slotName', action.payload.slotName);
      });
    }

    case ACTION_TYPES.SEND_ETHER_TO_SLOT_CONTRACT: {
      return state.withMutations(currentState => {
        const bigNumber = Web3Service.getWeb3().toBigNumber(
          parseFloat(action.payload.ethValue, 10) + parseFloat(currentState.get('deposit'), 10),
        );
        return currentState.set('deposit', bigNumber).set('isLoading', false).set('hasError', false);
      });
    }

    case ACTION_TYPES.START_TO_OCCUPY_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', true).set('hasError', false);
      });
    }

    case ACTION_TYPES.FAILED_TO_SEND_ETHER_TO_CONTRACT:
    case ACTION_TYPES.FAILED_TO_OCCUPY_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState.set('isLoading', false).set('hasError', true);
      });
    }

    case ACTION_TYPES.SUCCEEDED_TO_OCCUPY_SLOT_MACHINE: {
      return state.withMutations(currentState => {
        return currentState
          .set('isLoading', false)
          .set('hasError', false)
          .set('isOccupied', true)
          .set('isBreakAway', true);
      });
    }

    case ACTION_TYPES.START_TO_PLAY_GAME: {
      return state.withMutations(currentState => {
        return currentState.set('isPlaying', true).set('hasError', false);
      });
    }

    case ACTION_TYPES.FAILED_TO_PLAY_GAME: {
      return state.withMutations(currentState => {
        action.payload.transaction.id = currentState.get('betsData').size + 1;
        return currentState.set('hasError', true).update('betsData', list => list.unshift(action.payload.transaction));
      });
    }

    case ACTION_TYPES.SUCCEEDED_TO_PLAY_GAME: {
      return state.withMutations(currentState => {
        action.payload.betData.id = currentState.get('betsData').size + 1;
        return currentState
          .set('isPlaying', false)
          .set('deposit', currentState.get('deposit').plus(parseFloat(action.payload.diffMoney, 10)))
          .set('bankRoll', currentState.get('bankRoll').minus(parseFloat(action.payload.diffMoney, 10)))
          .set('temporaryBetData', action.payload.betData);
      });
    }

    case ACTION_TYPES.SET_BET_SIZE: {
      return state.set('betSize', action.payload.betSize);
    }

    case ACTION_TYPES.SET_LINE_NUM: {
      return state.set('lineNum', action.payload.lineNum);
    }

    case ACTION_TYPES.SET_BANK_ROLL: {
      return state.set('bankRoll', action.payload.bankRoll);
    }

    case ACTION_TYPES.SPIN_START: {
      return state.set('isSpinning', true);
    }

    case ACTION_TYPES.SPIN_END: {
      return state.set('isSpinning', false);
    }

    case ACTION_TYPES.TOGGLE_EMOTION: {
      return state.set('emotionClicked', state.get('emotionClicked') ^ 1);
    }

    case ACTION_TYPES.SET_WAIT_OCCUPY: {
      return state.set('waitOccupy', action.payload.waitOccupy);
    }

    case ACTION_TYPES.UPDATE_BREAK_AWAY_TRY: {
      return state.withMutations(currentState => {
        currentState.set('isBreakAway', action.payload.isBreakAway).set('isOccupied', action.payload.isOccupied);
      });
    }

    case ACTION_TYPES.INITIALIZE_PLAY_SLOT_STATE: {
      return PLAY_SLOT_INITIAL_STATE;
    }

    case ACTION_TYPES.UPDATE_BET_DATA_AFTER_STOP_SPIN: {
      return state.withMutations(currentState => {
        const betData = currentState.get('temporaryBetData');
        return currentState.set('temporaryBetData', {}).update('betsData', list => list.unshift(betData));
      });
    }

    default:
      return state;
  }
}
