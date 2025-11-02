// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title AdvancedRewardTokenV2
 * @dev EIP-2771 메타 트랜잭션을 지원하는 리워드 토큰 컨트랙트
 */
contract AdvancedRewardTokenV2 is ERC20, ERC2771Context, Ownable {
    
    // 기본 설정
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**5;
    uint8 public constant DECIMALS = 5;
    uint256 private _totalMinted;
    
    // 스테이킹 관련 구조체
    struct StakeInfo {
        uint256 amount;           // 스테이킹된 토큰 양
        uint256 startTime;        // 스테이킹 시작 시간
        uint256 lastClaimTime;    // 마지막 보상 청구 시간
        bool isActive;            // 스테이킹 활성화 여부
    }
    
    // 스테이킹 설정
    uint256 public stakingRewardRate = 10; // 연 10% 보상률
    uint256 public constant REWARD_PRECISION = 10000; // 100.00% = 10000
    uint256 public constant MIN_STAKE_AMOUNT = 10 * 10**5; // 최소 스테이킹 1000 토큰
    uint256 public constant STAKING_LOCK_PERIOD = 1 days; // 7일 락업 기간
    
    // 스테이킹 데이터
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public pendingRewards;
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    
    // 신규 사용자 보상
    mapping(address => bool) public hasReceivedWelcomeBonus;
    uint256 public constant WELCOME_BONUS = 10000 * 10**5; // 100토큰 (5자리 소수점)
    
    // 이벤트 정의
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsDistributed(uint256 totalAmount, uint256 timestamp);
    event WelcomeBonusReceived(address indexed user, uint256 amount, uint256 timestamp);
    
    /**
     * @dev 컨트랙트 생성자
     * @param name 토큰 이름
     * @param symbol 토큰 심볼
     * @param trustedForwarder EIP-2771 Forwarder 주소
     */
    constructor(
        string memory name,
        string memory symbol,
        address trustedForwarder
    ) ERC20(name, symbol) ERC2771Context(trustedForwarder) Ownable(_msgSender()) {
        // 초기 설정
    }
    
    /**
     * @dev 토큰 소수점 자릿수 반환
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
    
    /**
     * @dev 토큰 발행 (소유자만)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "AdvancedRewardToken: mint to the zero address");
        require(amount > 0, "AdvancedRewardToken: amount must be greater than 0");
        require(_totalMinted + amount <= MAX_SUPPLY, "AdvancedRewardToken: exceeds max supply");
        
        _totalMinted += amount;
        _mint(to, amount);
        
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev 토큰 소각
     */
    function burn(uint256 amount) public {
        address sender = _msgSender();  // ERC2771 지원
        require(amount > 0, "AdvancedRewardToken: amount must be greater than 0");
        require(balanceOf(sender) >= amount, "AdvancedRewardToken: insufficient balance");
        
        _totalMinted -= amount;
        _burn(sender, amount);
        
        emit TokensBurned(sender, amount);
    }
    
    /**
     * @dev 토큰 스테이킹
     */
    function stake(uint256 amount) public {
        address sender = _msgSender();  // ERC2771 지원
        require(amount >= MIN_STAKE_AMOUNT, "AdvancedRewardToken: insufficient stake amount");
        require(balanceOf(sender) >= amount, "AdvancedRewardToken: insufficient balance");
        
        // 기존 스테이킹이 있다면 보상 계산
        if (stakes[sender].isActive) {
            _calculateRewards(sender);
        }
        
        // 토큰 전송 (스테이킹)
        _transfer(sender, address(this), amount);
        
        // 스테이킹 정보 업데이트
        stakes[sender].amount += amount;
        stakes[sender].startTime = block.timestamp;
        stakes[sender].lastClaimTime = block.timestamp;
        stakes[sender].isActive = true;
        
        totalStaked += amount;
        
        emit Staked(sender, amount, block.timestamp);
    }
    
    /**
     * @dev 스테이킹 해제
     */
    function unstake(uint256 amount) public {
        address sender = _msgSender();  // ERC2771 지원
        require(stakes[sender].isActive, "AdvancedRewardToken: no active stake");
        require(amount <= stakes[sender].amount, "AdvancedRewardToken: insufficient staked amount");
        require(block.timestamp >= stakes[sender].startTime + STAKING_LOCK_PERIOD, "AdvancedRewardToken: stake is locked");
        
        // 보상 계산 및 지급
        _calculateRewards(sender);
        _claimRewards(sender);
        
        // 스테이킹 해제
        stakes[sender].amount -= amount;
        totalStaked -= amount;
        
        // 토큰 반환
        _transfer(address(this), sender, amount);
        
        // 스테이킹이 모두 해제되면 비활성화
        if (stakes[sender].amount == 0) {
            stakes[sender].isActive = false;
        }
        
        emit Unstaked(sender, amount, block.timestamp);
    }
    
    /**
     * @dev 보상 청구
     */
    function claimRewards() public {
        address sender = _msgSender();  // ERC2771 지원
        require(stakes[sender].isActive, "AdvancedRewardToken: no active stake");
        
        _calculateRewards(sender);
        _claimRewards(sender);
    }
    
    /**
     * @dev 보상 계산 (내부 함수)
     */
    function _calculateRewards(address user) internal {
        if (!stakes[user].isActive) return;
        
        uint256 timeElapsed = block.timestamp - stakes[user].lastClaimTime;
        uint256 reward = (stakes[user].amount * stakingRewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
        
        pendingRewards[user] += reward;
        stakes[user].lastClaimTime = block.timestamp;
    }
    
    /**
     * @dev 보상 지급 (내부 함수)
     */
    function _claimRewards(address user) internal {
        uint256 reward = pendingRewards[user];
        if (reward > 0) {
            pendingRewards[user] = 0;
            _mint(user, reward);
            totalRewardsDistributed += reward;
            
            emit RewardsClaimed(user, reward, block.timestamp);
        }
    }
    
    /**
     * @dev 보상률 설정 (소유자만)
     */
    function setRewardRate(uint256 newRate) public onlyOwner {
        require(newRate <= 5000, "AdvancedRewardToken: reward rate too high"); // 최대 50%
        stakingRewardRate = newRate;
    }
    
    /**
     * @dev 일괄 보상 분배 (소유자만)
     */
    function distributeRewards() public onlyOwner {
        emit RewardsDistributed(totalRewardsDistributed, block.timestamp);
    }
    
    /**
     * @dev 사용자 스테이킹 정보 조회
     */
    function getStakeInfo(address user) public view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lastClaimTime,
        bool isActive,
        uint256 pendingReward
    ) {
        StakeInfo memory stakeInfo = stakes[user];
        uint256 reward = 0;
        
        if (stakeInfo.isActive) {
            uint256 timeElapsed = block.timestamp - stakeInfo.lastClaimTime;
            reward = (stakeInfo.amount * stakingRewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
            reward += pendingRewards[user];
        }
        
        return (
            stakeInfo.amount,
            stakeInfo.startTime,
            stakeInfo.lastClaimTime,
            stakeInfo.isActive,
            reward
        );
    }
    
    /**
     * @dev 현재까지 발행된 토큰 총량
     */
    function totalMinted() public view returns (uint256) {
        return _totalMinted;
    }
    
    /**
     * @dev 최대 공급량
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }
    
    /**
     * @dev 남은 발행 가능한 토큰 양
     */
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - _totalMinted;
    }
    
    /**
     * @dev 관리자 전용 토큰 발행 함수 (환영 보너스용)
     */
    function mintTo(address to, uint256 amount) public onlyOwner {
        require(_totalMinted + amount <= MAX_SUPPLY, "AdvancedRewardToken: exceeds max supply");
        require(amount > 0, "AdvancedRewardToken: amount must be greater than 0");
        
        _totalMinted += amount;
        _mint(to, amount);
        
        emit TokensMinted(to, amount);
    }

    // ====== ERC20 Transfer Override (ERC2771 지원) ======
    
    /**
     * @dev transfer 함수 오버라이드 (ERC2771 메타 트랜잭션 지원)
     * _msgSender()를 사용하여 실제 사용자 주소에서 전송되도록 함
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        address sender = _msgSender();  // ERC2771 지원: 메타 트랜잭션에서 실제 sender
        _transfer(sender, to, amount);
        return true;
    }

    /**
     * @dev transferFrom 함수 오버라이드 (ERC2771 메타 트랜잭션 지원)
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = _msgSender();  // ERC2771 지원: 메타 트랜잭션에서 실제 sender
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    // ====== ERC2771 Context Override ======
    
    /**
     * @dev ERC2771에서 실제 sender 추출
     * Forwarder를 통한 메타 트랜잭션인 경우 msg.data의 마지막 20바이트에서 추출
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    /**
     * @dev ERC2771에서 실제 data 추출
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    /**
     * @dev _contextSuffixLength override (ERC2771)
     */
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}

